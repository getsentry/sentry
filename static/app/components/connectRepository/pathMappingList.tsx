import {useEffect, useRef, useState} from 'react';

import {Button} from '@sentry/scraps/button';
import {Flex, Stack} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import {IconAdd} from 'sentry/icons';
import {t, tct} from 'sentry/locale';

import {DEFAULT_BRANCH, normalizedPathMappingSchema} from './normalization';
import {PathMapping} from './pathMapping';
import type {PathMappingValue} from './type';
import {getPathMappingWarnings} from './warnings';

interface PathMappingListProps {
  onChange: (pathMappings: PathMappingValue[]) => void;
  defaultBranch?: string;
  pathMappings?: PathMappingValue[];
  providerKey?: string;
}

interface Entry {
  id: number;
  // New rows show only the edit form while expanded; existing rows pin the
  // summary above the form. Cleared when a new row with content is collapsed.
  isNew: boolean;
  value: PathMappingValue;
}

const EMPTY_MAPPING: PathMappingValue = {stackRoot: '', sourceRoot: '', branch: ''};

const hasContent = (value: PathMappingValue) =>
  value.stackRoot.trim() !== '' || value.sourceRoot.trim() !== '';

const mappingKey = (value: PathMappingValue) => {
  const {stackRoot, sourceRoot, branch} = normalizedPathMappingSchema.parse(value);
  return `${stackRoot}\0${sourceRoot}\0${branch}`;
};

const hasDuplicateMappings = (entries: Entry[]) => {
  const keys = entries
    .filter(entry => hasContent(entry.value))
    .map(entry => mappingKey(entry.value));
  return new Set(keys).size !== keys.length;
};

// Collapsing a filled new row promotes it to an established mapping so
// reopening it shows the summary pinned above the editor.
const clearNewOnCollapse = (entries: Entry[], collapsingId: number | null) =>
  collapsingId === null
    ? entries
    : entries.map(entry =>
        entry.id === collapsingId && hasContent(entry.value)
          ? {...entry, isNew: false}
          : entry
      );

export function PathMappingList({
  pathMappings,
  onChange,
  providerKey,
  defaultBranch,
}: PathMappingListProps) {
  const newRowValue: PathMappingValue = {
    ...EMPTY_MAPPING,
    branch: defaultBranch ?? DEFAULT_BRANCH,
  };

  const [entries, setEntries] = useState<Entry[]>(() => {
    const seeded = (pathMappings ?? []).map((value, index) => ({
      id: index,
      isNew: false,
      value,
    }));
    return seeded.length > 0 ? seeded : [{id: 0, isNew: true, value: newRowValue}];
  });

  // IDs start after the initial entries so that subsequent additions never
  // collide with the seeded ids (0, 1, ..., n-1).
  const idRef = useRef(entries.length);
  const nextId = () => idRef.current++;

  const [openId, setOpenId] = useState<number | null>(() =>
    entries.length === 1 && entries[0]!.isNew ? entries[0]!.id : null
  );

  // Report filled entries to the parent after every entries change.
  // Calling onChange inside a setEntries updater would update a different
  // component during the render phase, which React disallows.
  useEffect(() => {
    onChange(entries.map(entry => entry.value));
  }, [entries, onChange]);

  const handleChange = (id: number, value: PathMappingValue) => {
    // Merge rather than replace so that seeded rows keep their `id` field
    // even when PathMappingEdit only returns the three form fields.
    setEntries(prev =>
      prev.map(entry =>
        entry.id === id ? {...entry, value: {...entry.value, ...value}} : entry
      )
    );
  };

  const handleDelete = (id: number) => {
    // Compute a fresh id now so the updater doesn't need to capture stale state.
    const freshId = nextId();
    setEntries(prev => {
      const remaining = prev.filter(entry => entry.id !== id);
      // Deleting the last mapping reseeds a fresh open row — matching mount behavior.
      if (remaining.length === 0) {
        setOpenId(freshId);
        return [{id: freshId, isNew: true, value: newRowValue}];
      }
      setOpenId(open => (open === id ? null : open));
      return remaining;
    });
  };

  const handleAddAnother = () => {
    const last = entries.at(-1);
    // If the trailing row is still empty, reopen it rather than stacking another blank.
    if (last && !hasContent(last.value)) {
      setEntries(prev => clearNewOnCollapse(prev, openId));
      setOpenId(last.id);
      return;
    }
    const id = nextId();
    setEntries(prev => [
      ...clearNewOnCollapse(prev, openId),
      {id, isNew: true, value: newRowValue},
    ]);
    setOpenId(id);
  };

  const toggle = (id: number) => {
    setEntries(prev => clearNewOnCollapse(prev, openId));
    setOpenId(open => (open === id ? null : id));
  };

  const duplicate = hasDuplicateMappings(entries);
  const addDisabledReason = duplicate
    ? t('Resolve the duplicate path mapping first')
    : undefined;

  const warnings = getPathMappingWarnings(entries.map(e => e.value));

  return (
    <Stack gap="lg">
      <Stack gap="xs">
        <Text bold>{tct('Paths ([count])', {count: entries.length})}</Text>
        <Text size="sm" variant="muted">
          {t(
            'Tell Sentry how to translate file paths, so errors open the right line of code.'
          )}
        </Text>
      </Stack>

      <Stack gap="md">
        {entries.map((entry, index) => (
          <PathMapping
            key={entry.id}
            {...entry.value}
            editing={openId === entry.id}
            isNew={entry.isNew}
            providerKey={providerKey}
            defaultBranch={defaultBranch}
            warning={warnings[index]}
            onChange={value => handleChange(entry.id, value)}
            onDelete={() => handleDelete(entry.id)}
            onExpandToggle={() => toggle(entry.id)}
          />
        ))}
      </Stack>

      <Flex justify="end">
        <Button
          size="xs"
          variant="transparent"
          icon={<IconAdd />}
          disabled={Boolean(addDisabledReason)}
          tooltipProps={{title: addDisabledReason}}
          onClick={handleAddAnother}
        >
          {t('Add another path')}
        </Button>
      </Flex>
    </Stack>
  );
}
