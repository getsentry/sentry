import {Fragment, useRef, useState} from 'react';

import {Button} from '@sentry/scraps/button';
import {withForm} from '@sentry/scraps/form';
import {Flex, Stack} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import {IconAdd} from 'sentry/icons';
import {t, tct} from 'sentry/locale';

import {DEFAULT_BRANCH, normalizePathMapping} from './normalization';
import {PathMapping} from './pathMapping';
import type {PathMappingValue} from './type';

interface RowMeta {
  id: number;
  isNew: boolean;
}

const EMPTY_MAPPING: PathMappingValue = {stackRoot: '', sourceRoot: '', branch: ''};

const hasContent = (value: PathMappingValue) =>
  value.stackRoot.trim() !== '' || value.sourceRoot.trim() !== '';

const mappingKey = (value: PathMappingValue, branchFallback: string) => {
  const {stackRoot, sourceRoot, branch} = normalizePathMapping(value, branchFallback);
  return `${stackRoot}\0${sourceRoot}\0${branch}`;
};

const hasDuplicateMappings = (values: PathMappingValue[], branchFallback: string) => {
  const keys = values.map(value => mappingKey(value, branchFallback));
  return new Set(keys).size !== keys.length;
};

const clearIsNewOnCollapse = (
  meta: RowMeta[],
  collapsingId: number | null,
  values: PathMappingValue[]
): RowMeta[] => {
  if (collapsingId === null) {
    return meta;
  }
  return meta.map((m, i) =>
    m.id === collapsingId && hasContent(values[i] ?? EMPTY_MAPPING)
      ? {...m, isNew: false}
      : m
  );
};

export const PathMappingList = withForm({
  defaultValues: {
    repository: null as string | null,
    pathMappings: [] as PathMappingValue[],
  },
  props: {} as {
    defaultBranch?: string;
    providerKey?: string;
  },
  render: function PathMappingListRender({form, providerKey, defaultBranch}) {
    const branchFallback = defaultBranch ?? DEFAULT_BRANCH;
    const newRowValue: PathMappingValue = {...EMPTY_MAPPING, branch: branchFallback};

    const idRef = useRef(0);
    const nextId = () => idRef.current++;

    const [rowMeta, setRowMeta] = useState<RowMeta[]>(() => {
      const initial = form.state.values.pathMappings;
      idRef.current = initial.length;
      return initial.map((v, i) => ({id: i, isNew: !hasContent(v)}));
    });

    const [openId, setOpenId] = useState<number | null>(() =>
      rowMeta.length === 1 && rowMeta[0]!.isNew ? rowMeta[0]!.id : null
    );

    const toggle = (id: number) => {
      const currentValues = form.state.values.pathMappings;
      setRowMeta(prev => clearIsNewOnCollapse(prev, openId, currentValues));
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

        <form.AppField name="pathMappings" mode="array">
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
              const currentValues = form.state.values.pathMappings;
              field.pushValue(newRowValue);
              setRowMeta(prev => [
                ...clearIsNewOnCollapse(prev, openId, currentValues),
                {id, isNew: true},
              ]);
              setOpenId(id);
            };

            // Subscribe to live per-row values so the duplicate check and
            // collapsed summaries update while the user types.
            return (
              <form.Subscribe selector={state => state.values.pathMappings}>
                {pathMappings => {
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
                              fields={fields}
                              form={form}
                              isNew={meta.isNew}
                              value={value}
                              providerKey={providerKey}
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
        </form.AppField>
      </Stack>
    );
  },
});

export type ConnectRepoForm = React.ComponentProps<typeof PathMappingList>['form'];
