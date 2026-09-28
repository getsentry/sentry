import {Container, Stack} from '@sentry/scraps/layout';

import {PathMappingEdit} from './pathMappingEdit';
import {PathMappingSummary} from './pathMappingSummary';
import type {PathMappingValue} from './type';
import type {PathMappingWarning} from './warnings';

interface PathMappingProps extends PathMappingValue {
  /**
   * When true, renders the editable form. Existing mappings keep their summary
   * pinned above the form; new mappings (isNew) hide it since there is nothing
   * to collapse back to yet.
   */
  editing: boolean;
  isNew: boolean;
  onChange: (value: PathMappingValue) => void;
  onDelete: () => void;
  onExpandToggle: () => void;
  defaultBranch?: string;
  providerKey?: string;
  warning?: PathMappingWarning | null;
}

export function PathMapping({
  editing,
  isNew,
  onChange,
  onDelete,
  onExpandToggle,
  defaultBranch,
  providerKey,
  warning,
  ...value
}: PathMappingProps) {
  const showSummary = !(editing && isNew);

  return (
    <Stack border="muted" radius="md">
      {showSummary && (
        <PathMappingSummary
          {...value}
          expanded={editing}
          warning={warning}
          onDelete={onDelete}
          onExpandToggle={onExpandToggle}
        />
      )}
      {showSummary && editing && <Container borderTop="muted" />}
      {editing && (
        <PathMappingEdit
          {...value}
          providerKey={providerKey}
          defaultBranch={defaultBranch}
          warning={warning}
          onChange={onChange}
        />
      )}
    </Stack>
  );
}
