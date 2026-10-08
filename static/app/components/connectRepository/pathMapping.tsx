import {Container, Stack} from '@sentry/scraps/layout';

import {PathMappingEdit} from './pathMappingEdit';
import type {ConnectRepoForm} from './pathMappingList';
import {PathMappingSummary} from './pathMappingSummary';
import type {PathMappingValue} from './type';
import {isExactWarning, type PathMappingWarning} from './warnings';

interface PathMappingProps {
  editing: boolean;
  fields: `pathMappings[${number}]`;
  form: ConnectRepoForm;
  isNew: boolean;
  onDelete: () => void;
  onExpandToggle: () => void;
  /** Current field values — used by the collapsed summary row. */
  value: PathMappingValue;
  defaultBranch?: string;
  /** A new row with no summary can delete itself only when another row exists. */
  enableDelete?: boolean;
  projectSlug?: string;
  providerKey?: string;
  warning?: PathMappingWarning;
}

export function PathMapping({
  editing,
  fields,
  form,
  isNew,
  enableDelete = false,
  value,
  onDelete,
  onExpandToggle,
  defaultBranch,
  projectSlug,
  providerKey,
  warning,
}: PathMappingProps) {
  const showSummary = !(editing && isNew);
  const editorOnDelete = !showSummary && enableDelete ? onDelete : undefined;
  const hasWarning = isExactWarning(warning);

  return (
    <Stack border={hasWarning ? 'warning' : 'muted'} radius="md" overflow="hidden">
      {showSummary && (
        <PathMappingSummary
          {...value}
          defaultBranch={defaultBranch}
          expanded={editing}
          projectSlug={projectSlug}
          warning={warning}
          onDelete={onDelete}
          onExpandToggle={onExpandToggle}
        />
      )}
      {showSummary && editing && <Container borderTop="muted" />}
      {editing && (
        <PathMappingEdit
          form={form}
          fields={{
            branch: `${fields}.branch`,
            stackRoot: `${fields}.stackRoot`,
            sourceRoot: `${fields}.sourceRoot`,
          }}
          providerKey={providerKey}
          defaultBranch={defaultBranch}
          projectSlug={projectSlug}
          hasCodeOwner={value.hasCodeOwner}
          warning={warning}
          onDelete={editorOnDelete}
        />
      )}
    </Stack>
  );
}
