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
  /**
   * When set on an open row, the editor owns delete and the summary hides its button.
   */
  enableDelete?: boolean;
  projectSlug?: string;
  providerKey?: string;
  warning?: PathMappingWarning | null;
}

export function PathMapping({
  editing,
  isNew,
  enableDelete = false,
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
  const editorOnDelete = editing && enableDelete ? onDelete : undefined;
  const hasWarning = warning?.type === 'exact';

  return (
    <Stack border={hasWarning ? 'warning' : 'muted'} radius="md" overflow="hidden">
      {showSummary && (
        <PathMappingSummary
          {...value}
          expanded={editing}
          warning={warning ?? null}
          onDelete={editorOnDelete ? undefined : onDelete}
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
          warning={warning ?? null}
          onChange={onChange}
          onDelete={editorOnDelete}
        />
      )}
    </Stack>
  );
}
