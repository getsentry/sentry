import {useRef, useState} from 'react';

import {Button} from '@sentry/scraps/button';
import {Flex, Stack} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import {IconAdd} from 'sentry/icons';
import {t, tct} from 'sentry/locale';

import {
  normalizedPathMappingSchema,
  PathMapping,
  type PathMappingValue,
} from './pathMapping';

interface PathMappingListProps {
  /**
   * Called whenever the set of mappings changes. Receives the list of mappings
   * that have content (empty new rows are omitted).
   */
  onChange: (pathMappings: PathMappingValue[]) => void;
  /**
   * The persisted mappings to seed the list with. When empty, the list starts
   * with a single new mapping ready to fill out.
   */
  pathMappings?: PathMappingValue[];
}

interface Entry {
  id: number;
  /**
   * New (not-yet-persisted) rows render the editable form without a summary
   * while expanded. Existing rows keep their summary pinned above the form.
   */
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

/**
 * Whether two or more filled mappings are identical. Used to block adding
 * another path until the duplicate is resolved.
 */
const hasDuplicateMappings = (entries: Entry[]) => {
  const keys = entries
    .filter(entry => hasContent(entry.value))
    .map(entry => mappingKey(entry.value));

  return new Set(keys).size !== keys.length;
};

/**
 * Once a row with content is collapsed it represents an established mapping, so
 * drop its `isNew` flag. Reopening it should then pin the summary above the
 * editor like any other existing mapping, rather than hiding it as we do while
 * a brand-new row is first being filled out.
 */
const clearNewOnCollapse = (entries: Entry[], collapsingId: number | null) =>
  collapsingId === null
    ? entries
    : entries.map(entry =>
        entry.id === collapsingId && hasContent(entry.value)
          ? {...entry, isNew: false}
          : entry
      );

export function PathMappingList({pathMappings, onChange}: PathMappingListProps) {
  const idRef = useRef(0);
  const nextId = () => idRef.current++;

  const [entries, setEntries] = useState<Entry[]>(() => {
    const seeded = (pathMappings ?? []).map(value => ({
      id: nextId(),
      isNew: false,
      value,
    }));

    return seeded.length > 0
      ? seeded
      : [{id: nextId(), isNew: true, value: EMPTY_MAPPING}];
  });

  // Only a single mapping can be expanded at a time. Start with the initial new
  // mapping open; otherwise everything is collapsed.
  const [openId, setOpenId] = useState<number | null>(() =>
    entries.length === 1 && entries[0]!.isNew ? entries[0]!.id : null
  );

  const commit = (next: Entry[]) => {
    setEntries(next);
    onChange(next.map(entry => entry.value).filter(hasContent));
  };

  const handleChange = (id: number, value: PathMappingValue) => {
    commit(entries.map(entry => (entry.id === id ? {...entry, value} : entry)));
  };

  const handleDelete = (id: number) => {
    const remaining = entries.filter(entry => entry.id !== id);

    // Deleting the last mapping would leave nothing to fill out, so fall back
    // to a fresh open row — the same state the list seeds itself with when
    // there are no mappings to begin with.
    if (remaining.length === 0) {
      const newId = nextId();
      commit([{id: newId, isNew: true, value: EMPTY_MAPPING}]);
      setOpenId(newId);
      return;
    }

    commit(remaining);
    setOpenId(open => (open === id ? null : open));
  };

  const handleAddAnother = () => {
    // If the last row is still empty, just reopen it rather than stacking
    // another blank row on top of it.
    const last = entries.at(-1);
    if (last && !hasContent(last.value)) {
      setEntries(prev => clearNewOnCollapse(prev, openId));
      setOpenId(last.id);
      return;
    }

    const id = nextId();
    setEntries(prev => [
      ...clearNewOnCollapse(prev, openId),
      {id, isNew: true, value: EMPTY_MAPPING},
    ]);
    setOpenId(id);
  };

  const toggle = (id: number) => {
    // Whichever row currently has focus is the one being collapsed.
    setEntries(prev => clearNewOnCollapse(prev, openId));
    setOpenId(open => (open === id ? null : id));
  };

  const duplicate = hasDuplicateMappings(entries);
  const addDisabledReason = duplicate
    ? t('Resolve the duplicate path mapping first')
    : undefined;

  // Nothing to add while the trailing empty row is already open for editing —
  // "Add another path" only reopens it when it's collapsed.
  const last = entries.at(-1);
  const editingEmptyRow =
    last !== undefined && !hasContent(last.value) && openId === last.id;

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
        {entries.map(entry => (
          <PathMapping
            key={entry.id}
            {...entry.value}
            editing={openId === entry.id}
            isNew={entry.isNew}
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
          disabled={Boolean(addDisabledReason) || editingEmptyRow}
          tooltipProps={{title: addDisabledReason}}
          onClick={handleAddAnother}
        >
          {t('Add another path')}
        </Button>
      </Flex>
    </Stack>
  );
}
