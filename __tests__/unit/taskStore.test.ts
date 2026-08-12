/**
 * Unit tests for the Zustand reference store.
 *
 * Two things worth knowing before you copy this file:
 *
 * 1. Zustand stores are module singletons, so state leaks between tests unless
 *    you reset it. `useTaskStore.setState` in beforeEach is the sanctioned way.
 *
 * 2. `act()` is only needed when a component/hook is actually rendered. The
 *    plain store tests below mutate state directly with no React involved, so
 *    wrapping them in act() would be noise — and in @testing-library/react-native
 *    v14 act() is async, so a non-awaited act() actively logs a warning.
 */
import { act, renderHook } from '@testing-library/react-native';

import {
  useTaskStore,
  useTaskCounts,
  useVisibleTasks,
  taskStoreApi,
} from '../../src/features/tasks/store/taskStore';

beforeEach(() => {
  useTaskStore.setState({ tasks: [], filter: 'all' });
});

describe('taskStore', () => {
  describe('addTask', () => {
    it('adds a task to the front of the list', () => {
      useTaskStore.getState().addTask('First');
      useTaskStore.getState().addTask('Second');

      const { tasks } = useTaskStore.getState();
      expect(tasks).toHaveLength(2);
      expect(tasks[0]?.title).toBe('Second');
      expect(tasks[0]?.completed).toBe(false);
    });

    it('trims surrounding whitespace', () => {
      useTaskStore.getState().addTask('   padded   ');
      expect(useTaskStore.getState().tasks[0]?.title).toBe('padded');
    });

    it('ignores an empty or whitespace-only title', () => {
      useTaskStore.getState().addTask('');
      useTaskStore.getState().addTask('    ');
      expect(useTaskStore.getState().tasks).toHaveLength(0);
    });

    it('gives each task a unique id', () => {
      useTaskStore.getState().addTask('a');
      useTaskStore.getState().addTask('b');
      useTaskStore.getState().addTask('c');

      const ids = useTaskStore.getState().tasks.map((t) => t.id);
      expect(new Set(ids).size).toBe(3);
    });
  });

  describe('toggleTask', () => {
    it('flips the completed flag', () => {
      useTaskStore.getState().addTask('Toggle me');
      const id = useTaskStore.getState().tasks[0]!.id;

      useTaskStore.getState().toggleTask(id);
      expect(useTaskStore.getState().tasks[0]?.completed).toBe(true);

      useTaskStore.getState().toggleTask(id);
      expect(useTaskStore.getState().tasks[0]?.completed).toBe(false);
    });

    it('is a no-op for an unknown id rather than throwing', () => {
      expect(() => useTaskStore.getState().toggleTask('does-not-exist')).not.toThrow();
    });
  });

  describe('removeTask / clearCompleted', () => {
    it('removes only the matching task', () => {
      useTaskStore.getState().addTask('keep');
      useTaskStore.getState().addTask('remove');
      const removeId = useTaskStore.getState().tasks[0]!.id;

      useTaskStore.getState().removeTask(removeId);

      const { tasks } = useTaskStore.getState();
      expect(tasks).toHaveLength(1);
      expect(tasks[0]?.title).toBe('keep');
    });

    it('clears completed tasks and leaves active ones', () => {
      useTaskStore.getState().addTask('active');
      useTaskStore.getState().addTask('done');
      const doneId = useTaskStore.getState().tasks[0]!.id;

      useTaskStore.getState().toggleTask(doneId);
      useTaskStore.getState().clearCompleted();

      const { tasks } = useTaskStore.getState();
      expect(tasks).toHaveLength(1);
      expect(tasks[0]?.title).toBe('active');
    });
  });

  describe('selectors', () => {
    // renderHook is async in @testing-library/react-native v14, and so is the
    // rerender it returns.
    it('useVisibleTasks respects the active filter', async () => {
      useTaskStore.getState().addTask('active one');
      useTaskStore.getState().addTask('completed one');
      const completedId = useTaskStore.getState().tasks[0]!.id;
      useTaskStore.getState().toggleTask(completedId);

      const { result, rerender } = await renderHook(() => useVisibleTasks());
      expect(result.current).toHaveLength(2);

      // NOW the store has a mounted subscriber, so every mutation triggers a
      // React render and must be wrapped in act() — and act() is async in v14.
      await act(async () => {
        useTaskStore.getState().setFilter('active');
      });
      await rerender({});
      expect(result.current).toHaveLength(1);
      expect(result.current?.[0]?.title).toBe('active one');

      await act(async () => {
        useTaskStore.getState().setFilter('completed');
      });
      await rerender({});
      expect(result.current).toHaveLength(1);
      expect(result.current?.[0]?.title).toBe('completed one');
    });

    it('useTaskCounts reports totals', async () => {
      useTaskStore.getState().addTask('one');
      useTaskStore.getState().addTask('two');
      const id = useTaskStore.getState().tasks[0]!.id;
      useTaskStore.getState().toggleTask(id);

      const { result } = await renderHook(() => useTaskCounts());
      expect(result.current).toEqual({ total: 2, active: 1, completed: 1 });
    });
  });

  describe('taskStoreApi (non-React access)', () => {
    it('adds a task without a component mounted', () => {
      taskStoreApi.addTask('from a push handler');
      expect(taskStoreApi.getState().tasks[0]?.title).toBe('from a push handler');
    });
  });
});
