import {Container, Stack} from '@sentry/scraps/layout';

import {PathMappingEdit} from './pathMappingEdit';
import type {ConnectRepoForm} from './pathMappingList';
import {PathMappingSummary} from './pathMappingSummary';
import type {PathMappingValue} from './type';
import type {PathMappingWarning} from './warnings';

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
  projectSlug?: string;
  providerKey?: string;
  warning?: PathMappingWarning | null;
}

export function PathMapping({
  editing,
  fields,
  form,
  isNew,
  value,
  onDelete,
  onExpandToggle,
  defaultBranch,
  projectSlug,
  providerKey,
  warning,
}: PathMappingProps) {
  const showSummary = !(editing && isNew);

  return (
    <Stack border="muted" radius="md">
      {showSummary && (
        <PathMappingSummary
          {...value}
          defaultBranch={defaultBranch}
          expanded={editing}
          warning={warning ?? null}
          onDelete={onDelete}
          onExpandToggle={onExpandToggle}
        />
      )}
      {showSummary && editing && <Container borderTop="muted" />}
      {editing && (
        <PathMappingEdit
          form={form}
          fields={fields}
          providerKey={providerKey}
          defaultBranch={defaultBranch}
          projectSlug={projectSlug}
          hasCodeOwner={value.hasCodeOwner}
          warning={warning ?? null}
        />
      )}
    </Stack>
  );
}
