/**
 * Zustand demo screen — the counterpart to src/features/tasks/store/taskStore.ts.
 *
 * Note what this component does NOT do: it never calls `useTaskStore()` without
 * a selector, so adding a task re-renders the list but not the filter bar, and
 * changing the filter doesn't re-render individual rows.
 */
import React, { memo, useCallback, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { useTranslation } from 'react-i18next';

import { Button } from '../../../components/Button';
import { Screen } from '../../../components/Screen';
import { Text } from '../../../components/Text';
import { TextField } from '../../../components/TextField';
import { useTheme } from '../../../theme/ThemeProvider';
import {
  useTaskActions,
  useTaskCounts,
  useVisibleTasks,
  useTaskStore,
  selectFilter,
  type Task,
  type TaskFilter,
} from '../store/taskStore';

/* -------------------------------------------------------------------------- */

type RowProps = {
  task: Task;
  onToggle: (id: string) => void;
  onRemove: (id: string) => void;
};

/**
 * memo() matters here: without it, every row re-renders whenever ANY task
 * changes. The handlers come from the store (stable identities), so the memo
 * comparison actually holds.
 */
const TaskRow = memo(function TaskRow({ task, onToggle, onRemove }: RowProps) {
  const { theme } = useTheme();

  return (
    <View style={[styles.row, { borderBottomColor: theme.colors.border.subtle }]}>
      <Pressable
        onPress={() => onToggle(task.id)}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: task.completed }}
        accessibilityLabel={task.title}
        style={styles.rowMain}
        hitSlop={8}>
        <View
          style={[
            styles.checkbox,
            {
              borderColor: task.completed ? theme.colors.brand.solid : theme.colors.border.strong,
              backgroundColor: task.completed ? theme.colors.brand.solid : 'transparent',
            },
          ]}>
          {task.completed ? (
            <Text variant="caption" tone="inverse">
              ✓
            </Text>
          ) : null}
        </View>

        <Text
          tone={task.completed ? 'muted' : 'primary'}
          style={[styles.rowTitle, task.completed && styles.completed]}
          numberOfLines={2}>
          {task.title}
        </Text>
      </Pressable>

      <Pressable
        onPress={() => onRemove(task.id)}
        accessibilityRole="button"
        accessibilityLabel={`Delete ${task.title}`}
        hitSlop={8}>
        <Text tone="danger">✕</Text>
      </Pressable>
    </View>
  );
});

/* -------------------------------------------------------------------------- */

const FILTERS: TaskFilter[] = ['all', 'active', 'completed'];

export default function TasksScreen() {
  const { t } = useTranslation();
  const { theme } = useTheme();

  const [draft, setDraft] = useState('');

  // Each of these subscribes to its own narrow slice.
  const tasks = useVisibleTasks();
  const filter = useTaskStore(selectFilter);
  const counts = useTaskCounts();
  const { addTask, toggleTask, removeTask, setFilter, clearCompleted } = useTaskActions();

  const onAdd = useCallback(() => {
    addTask(draft);
    setDraft('');
  }, [addTask, draft]);

  return (
    <Screen edges={['top', 'left', 'right']}>
      <Text variant="title">{t('tasks.title')}</Text>
      <Text variant="caption" tone="muted" style={styles.count}>
        {t('tasks.count', { count: counts.total })} · {counts.active} active
      </Text>

      <View style={styles.addRow}>
        <TextField
          containerStyle={styles.addField}
          placeholder={t('tasks.addPlaceholder')}
          value={draft}
          onChangeText={setDraft}
          onSubmitEditing={onAdd}
          returnKeyType="done"
        />
        <Button title={t('tasks.add')} onPress={onAdd} disabled={!draft.trim()} />
      </View>

      <View style={styles.filters}>
        {FILTERS.map((option) => {
          const active = option === filter;
          return (
            <Pressable
              key={option}
              onPress={() => setFilter(option)}
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
              style={[
                styles.filterChip,
                {
                  backgroundColor: active ? theme.colors.brand.solid : theme.colors.bg.surface,
                  borderColor: active ? theme.colors.brand.solid : theme.colors.border.subtle,
                },
              ]}>
              <Text variant="label" tone={active ? 'inverse' : 'secondary'}>
                {t(`tasks.filters.${option}`)}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {/* FlashList instead of FlatList: it recycles rows rather than mounting
          one component per item, which is what keeps long lists at 60fps. */}
      <FlashList
        data={tasks}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <TaskRow task={item} onToggle={toggleTask} onRemove={removeTask} />
        )}
        ListEmptyComponent={
          <Text tone="muted" style={styles.empty}>
            {t('tasks.empty')}
          </Text>
        }
        contentContainerStyle={styles.listContent}
      />

      {counts.completed > 0 ? (
        <Button
          title={t('tasks.clearCompleted')}
          variant="secondary"
          onPress={clearCompleted}
          fullWidth
        />
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  count: { marginTop: 4, marginBottom: 16 },
  addRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  addField: { flex: 1 },
  filters: { flexDirection: 'row', gap: 8, marginTop: 16, marginBottom: 8 },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
  },
  listContent: { paddingVertical: 8 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    gap: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  rowMain: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowTitle: { flex: 1 },
  completed: { textDecorationLine: 'line-through' },
  empty: { textAlign: 'center', marginTop: 32 },
});
