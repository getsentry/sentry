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
  projectSlug?: string;
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
  projectSlug,
  providerKey,
  warning,
  ...value
}: PathMappingProps) {
  const showSummary = !(editing && isNew);
  const effectiveWarning: PathMappingWarning | null = value.hasCodeOwner
    ? {type: 'codeOwner'}
    : (warning ?? null);

  return (
    <Stack border="muted" radius="md">
      {showSummary && (
        <PathMappingSummary
          {...value}
          expanded={editing}
          warning={effectiveWarning}
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
          projectSlug={projectSlug}
          warning={effectiveWarning}
          onChange={onChange}
        />
      )}
    </Stack>
  );
}
