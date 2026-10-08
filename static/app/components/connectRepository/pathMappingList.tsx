import {Fragment, useRef, useState} from 'react';

import {Button} from '@sentry/scraps/button';
import {Flex, Stack} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import {IconAdd} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import type {RepositoryProjectPathConfig} from 'sentry/types/integrations';

import {DEFAULT_BRANCH, normalizePathMapping} from './normalization';
import {PathMapping} from './pathMapping';
import type {PathMappingValue} from './type';
import type {ConnectRepoForm} from './useConnectRepoForm';
import {getPathMappingWarnings} from './warnings';

export type {ConnectRepoForm} from './useConnectRepoForm';

interface RowMeta {
  id: number;
  isNew: boolean;
}

const EMPTY_MAPPING: PathMappingValue = {stackRoot: '', sourceRoot: '', branch: ''};

const mappingKey = (value: PathMappingValue, branchFallback: string) => {
  const {stackRoot, sourceRoot, branch} = normalizePathMapping(value, branchFallback);
  return `${stackRoot}\0${sourceRoot}\0${branch}`;
};

const hasDuplicateMappings = (values: PathMappingValue[], branchFallback: string) => {
  const keys = values.map(value => mappingKey(value, branchFallback));
  return new Set(keys).size !== keys.length;
};

// Collapsing a row promotes it to an established mapping so reopening it
// shows the summary pinned above the editor, even if the row is still empty.
const clearIsNewOnCollapse = (
  meta: RowMeta[],
  collapsingId: number | null
): RowMeta[] => {
  if (collapsingId === null) {
    return meta;
  }
  return meta.map(m => (m.id === collapsingId ? {...m, isNew: false} : m));
};

interface Props {
  form: ConnectRepoForm;
  defaultBranch?: string;
  existingMappings?: RepositoryProjectPathConfig[];
  projectSlug?: string;
  providerKey?: string;
  seededById?: Map<string, RepositoryProjectPathConfig>;
}

export function PathMappingList({
  form,
  providerKey,
  defaultBranch,
  existingMappings,
  projectSlug,
  seededById,
}: Props) {
  const branchFallback = defaultBranch ?? DEFAULT_BRANCH;
  const newRowValue: PathMappingValue = {...EMPTY_MAPPING, branch: branchFallback};

  const [rowMeta, setRowMeta] = useState<RowMeta[]>(() => {
    const initial = form.state.values.pathMappings;
    return initial.map((v, i) => ({id: i, isNew: !v.id}));
  });
  const idRef = useRef(rowMeta.length);
  const nextId = () => idRef.current++;

  const [openId, setOpenId] = useState<number | null>(() =>
    rowMeta.length === 1 && rowMeta[0]!.isNew ? rowMeta[0]!.id : null
  );

  const toggle = (id: number) => {
    setRowMeta(prev => clearIsNewOnCollapse(prev, openId));
    setOpenId(prev => (prev === id ? null : id));
  };

  return (
    <Stack gap="lg">
      <Stack gap="xs">
        <Text bold>{tct('Paths ([count])', {count: rowMeta.length})}</Text>
        <Text size="sm" variant="muted">
          {t(
            'Tell Sentry how to translate file paths, so errors open the right line of code.'
          )}
        </Text>
      </Stack>

      <form.ArrayField name="pathMappings">
        {field => {
          const handleDelete = (i: number) => {
            const freshId = nextId();
            if (form.state.values.pathMappings.length === 1) {
              form.setFieldValue('pathMappings', [newRowValue]);
              setRowMeta([{id: freshId, isNew: true}]);
              setOpenId(freshId);
            } else {
              field.removeValue(i);
              setRowMeta(prev => prev.filter((_, idx) => idx !== i));
              setOpenId(prev => (prev === rowMeta[i]!.id ? null : prev));
            }
          };

          const handleAddAnother = () => {
            const id = nextId();
            field.pushValue(newRowValue);
            setRowMeta(prev => [
              ...clearIsNewOnCollapse(prev, openId),
              {id, isNew: true},
            ]);
            setOpenId(id);
          };

          return (
            <form.Subscribe selector={state => state.values.pathMappings}>
              {pathMappings => {
                const warnings = getPathMappingWarnings(
                  pathMappings,
                  existingMappings,
                  seededById
                );
                const addDisabledReason = hasDuplicateMappings(
                  pathMappings,
                  branchFallback
                )
                  ? t('Resolve the duplicate path mapping first')
                  : undefined;

                return (
                  <Fragment>
                    <Stack gap="md">
                      {pathMappings.map((value, i) => {
                        const meta = rowMeta[i]!;
                        const fields: `pathMappings[${number}]` = `pathMappings[${i}]`;
                        return (
                          <PathMapping
                            key={meta.id}
                            editing={openId === meta.id}
                            enableDelete={pathMappings.length > 1}
                            fields={fields}
                            form={form}
                            isNew={meta.isNew}
                            value={value}
                            warning={warnings[i]}
                            providerKey={providerKey}
                            projectSlug={projectSlug}
                            defaultBranch={defaultBranch}
                            onDelete={() => handleDelete(i)}
                            onExpandToggle={() => toggle(meta.id)}
                          />
                        );
                      })}
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
                  </Fragment>
                );
              }}
            </form.Subscribe>
          );
        }}
      </form.ArrayField>
    </Stack>
  );
}
