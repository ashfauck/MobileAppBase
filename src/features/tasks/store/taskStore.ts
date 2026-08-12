/**
 * ============================================================================
 *  ZUSTAND REFERENCE STORE — read this file before writing your own.
 * ============================================================================
 *
 * A small task list that demonstrates every Zustand pattern this template
 * relies on. Delete the whole `src/features/tasks` folder once you're
 * comfortable; nothing else imports it except the demo screen and its tests.
 *
 * WHY ZUSTAND OVER REDUX TOOLKIT
 *   - No provider, no boilerplate: the store IS the hook.
 *   - Selector-level subscriptions by default, so re-renders stay narrow.
 *   - Trivial to read/write outside React (see `taskStoreApi` at the bottom) —
 *     which matters a lot for push-notification and interceptor code.
 *   RTK is still the better call if you need time-travel devtools as a team
 *   norm, RTK Query's cache, or a very large team that benefits from the
 *   ceremony. For server data we use TanStack Query instead of either.
 *
 * THE ONE RULE
 *   Zustand = CLIENT state (UI, local domain, ephemeral).
 *   TanStack Query = SERVER state (anything that came from an API).
 *   Duplicating server data into Zustand is the most common mistake; you then
 *   own cache invalidation by hand, forever.
 */
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';
import { useShallow } from 'zustand/react/shallow';

import { zustandMMKVStorage } from '../../../services/storage/mmkv';

/* -------------------------------------------------------------------------- */
/* 1. Types — state and actions declared separately.                          */
/*    Keeping them apart makes `partialize` and test fixtures much easier.    */
/* -------------------------------------------------------------------------- */

export type Task = {
  id: string;
  title: string;
  completed: boolean;
  createdAt: number;
};

export type TaskFilter = 'all' | 'active' | 'completed';

type TaskState = {
  tasks: Task[];
  filter: TaskFilter;
};

type TaskActions = {
  addTask: (title: string) => void;
  toggleTask: (id: string) => void;
  removeTask: (id: string) => void;
  setFilter: (filter: TaskFilter) => void;
  clearCompleted: () => void;
  reset: () => void;
};

export type TaskStore = TaskState & TaskActions;

const initialState: TaskState = {
  tasks: [],
  filter: 'all',
};

/* -------------------------------------------------------------------------- */
/* 2. The store.                                                              */
/*    Middleware order matters: persist(immer(fn)) — immer must be innermost  */
/*    so that persist serializes plain state, not a draft.                    */
/* -------------------------------------------------------------------------- */

export const useTaskStore = create<TaskStore>()(
  persist(
    immer((set, get) => ({
      ...initialState,

      // With immer you MUTATE the draft. Without it you would write:
      //   set(state => ({ tasks: [...state.tasks, task] }))
      // Immer earns its place as soon as you have nested updates.
      addTask: (title) => {
        const trimmed = title.trim();
        // Guard in the action, not the component: every caller gets the rule.
        if (!trimmed) return;

        set((state) => {
          state.tasks.unshift({
            id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            title: trimmed,
            completed: false,
            createdAt: Date.now(),
          });
        });
      },

      toggleTask: (id) => {
        set((state) => {
          const task = state.tasks.find((t: Task) => t.id === id);
          // No-op instead of throwing: the id may have been removed on another
          // screen between render and press.
          if (task) task.completed = !task.completed;
        });
      },

      removeTask: (id) => {
        set((state) => {
          state.tasks = state.tasks.filter((t: Task) => t.id !== id);
        });
      },

      setFilter: (filter) => {
        set((state) => {
          state.filter = filter;
        });
      },

      clearCompleted: () => {
        // `get()` reads current state inside an action — useful for guards.
        if (!get().tasks.some((t: Task) => t.completed)) return;

        set((state) => {
          state.tasks = state.tasks.filter((t: Task) => !t.completed);
        });
      },

      reset: () => set(() => ({ ...initialState })),
    })),
    {
      name: 'tasks',
      storage: createJSONStorage(() => zustandMMKVStorage),
      version: 1,
      // Persist the data, not the UI filter — a filter restored from three days
      // ago makes the list look empty and reads as a bug.
      partialize: (state) => ({ tasks: state.tasks }),
    },
  ),
);

/* -------------------------------------------------------------------------- */
/* 3. Selectors — THE performance-critical part.                              */
/* -------------------------------------------------------------------------- */

/**
 * ✅ Narrow selector: this component re-renders only when `filter` changes.
 *      const filter = useTaskStore(selectFilter);
 *
 * ❌ Never do this:
 *      const { tasks, filter } = useTaskStore();
 *    With no selector the component subscribes to the ENTIRE store and
 *    re-renders on every unrelated change.
 */
export const selectTasks = (s: TaskStore) => s.tasks;
export const selectFilter = (s: TaskStore) => s.filter;

/**
 * Derived data. Note this returns a NEW array each call, so it must be used
 * with `useShallow` (below) or it will re-render on every store change —
 * a new array reference never passes the default `Object.is` equality check.
 */
export function useVisibleTasks(): Task[] {
  return useTaskStore(
    useShallow((s) => {
      switch (s.filter) {
        case 'active':
          return s.tasks.filter((t) => !t.completed);
        case 'completed':
          return s.tasks.filter((t) => t.completed);
        default:
          return s.tasks;
      }
    }),
  );
}

/**
 * Selecting several primitives at once. `useShallow` compares the returned
 * object one level deep, so this re-renders only when one of these three
 * numbers actually changes.
 */
export function useTaskCounts() {
  return useTaskStore(
    useShallow((s) => ({
      total: s.tasks.length,
      active: s.tasks.filter((t) => !t.completed).length,
      completed: s.tasks.filter((t) => t.completed).length,
    })),
  );
}

/**
 * Actions never change identity, so grabbing them individually causes zero
 * extra renders. This is the recommended way to pull actions into a component.
 */
export function useTaskActions() {
  const addTask = useTaskStore((s) => s.addTask);
  const toggleTask = useTaskStore((s) => s.toggleTask);
  const removeTask = useTaskStore((s) => s.removeTask);
  const setFilter = useTaskStore((s) => s.setFilter);
  const clearCompleted = useTaskStore((s) => s.clearCompleted);

  return { addTask, toggleTask, removeTask, setFilter, clearCompleted };
}

/* -------------------------------------------------------------------------- */
/* 4. Using the store OUTSIDE React.                                          */
/*    Push handlers, axios interceptors and background tasks have no hooks.   */
/* -------------------------------------------------------------------------- */

export const taskStoreApi = {
  /** Read a snapshot. */
  getState: useTaskStore.getState,
  /** Write from anywhere — e.g. a notification action button. */
  addTask: (title: string) => useTaskStore.getState().addTask(title),
  /** Subscribe to changes outside a component; returns an unsubscribe fn. */
  subscribe: useTaskStore.subscribe,
};
