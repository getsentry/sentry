import {Fragment, useRef, useState} from 'react';
import {IconAdd} from '@sentry/icons/add';

import {Button} from '@sentry/scraps/button';
import {withForm} from '@sentry/scraps/form';
import {Container, Flex, Grid, Stack} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import {t} from 'sentry/locale';
import type {RepositoryProjectPathConfig} from 'sentry/types/integrations';

import {DEFAULT_BRANCH, normalizePathMapping} from './normalization';
import {PathMappingEmptyState} from './pathMappingEmptyState';
import {PATH_MAPPING_COLUMNS, PathMappingRow} from './pathMappingRow';
import type {PathMappingValue} from './type';
import {getPathMappingWarnings} from './warnings';

const EMPTY_MAPPING: PathMappingValue = {stackRoot: '', sourceRoot: '', branch: ''};

const mappingKey = (value: PathMappingValue, branchFallback: string) => {
  const {stackRoot, sourceRoot, branch} = normalizePathMapping(value, branchFallback);
  return `${stackRoot}\0${sourceRoot}\0${branch}`;
};

const hasDuplicateMappings = (values: PathMappingValue[], branchFallback: string) => {
  const keys = values.map(value => mappingKey(value, branchFallback));
  return new Set(keys).size !== keys.length;
};

function ColumnHeading({children}: {children: React.ReactNode}) {
  return (
    <Container minWidth={0}>
      <Text size="sm" bold ellipsis>
        {children}
      </Text>
    </Container>
  );
}

function PathMappingTableHeader() {
  return (
    <Container
      background="secondary"
      // Inner radius of the table's md corners, less its 1px border.
      radius="sm sm 0 0"
      padding="lg"
      display={{zero: 'none', sm: 'block'}}
    >
      <Grid columns={PATH_MAPPING_COLUMNS} gap="lg" align="center">
        <ColumnHeading>{t('Stack trace prefix')}</ColumnHeading>
        {/* Spacer for the arrow column; matches the row's sm arrow icon. */}
        <Container width="14px" />
        <ColumnHeading>{t('Repository prefix')}</ColumnHeading>
        <ColumnHeading>{t('Branch')}</ColumnHeading>
        {/* Spacer for the delete column; matches the zero-size icon button. */}
        <Container width="24px" />
      </Grid>
    </Container>
  );
}

export const PathMappingList = withForm({
  defaultValues: {
    repository: null as string | null,
    pathMappings: [] as PathMappingValue[],
  },
  props: {} as {
    allowEmpty?: boolean;
    defaultBranch?: string;
    existingMappings?: RepositoryProjectPathConfig[];
    projectSlug?: string;
    providerKey?: string;
    repositoryId?: string;
    seededById?: Map<string, RepositoryProjectPathConfig>;
  },
  render: function PathMappingListRender({
    form,
    allowEmpty,
    providerKey,
    defaultBranch,
    existingMappings,
    projectSlug,
    repositoryId,
    seededById,
  }) {
    const branchFallback = defaultBranch ?? DEFAULT_BRANCH;
    const newRowValue: PathMappingValue = {...EMPTY_MAPPING, branch: branchFallback};

    // Stable per-row ids for React keys; form values are index-addressed.
    const idRef = useRef(0);
    const nextId = () => idRef.current++;
    const [rowIds, setRowIds] = useState<number[]>(() => {
      const initial = form.state.values.pathMappings;
      idRef.current = initial.length;
      return initial.map((_, i) => i);
    });

    // Rows that haven't been saved yet stay quiet until focus leaves them, so a
    // blank row isn't flagged (e.g. as a duplicate of another blank row) before
    // the user has filled it in. Saved rows warn right away.
    const [untouchedIds, setUntouchedIds] = useState<Set<number>>(
      () =>
        new Set(
          form.state.values.pathMappings.flatMap((value, i) => (value.id ? [] : [i]))
        )
    );
    // The row just added with "Add mapping", which takes focus when it mounts.
    const [autoFocusId, setAutoFocusId] = useState<number | null>(null);

    const markTouched = (id: number) => {
      setUntouchedIds(prev => {
        if (!prev.has(id)) {
          return prev;
        }
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      // Rows remount when their index changes; don't steal focus again then.
      setAutoFocusId(prev => (prev === id ? null : prev));
    };

    const addUntouchedRow = (id: number) =>
      setUntouchedIds(prev => new Set(prev).add(id));

    return (
      <Stack gap="lg">
        <Stack gap="xs">
          <Text bold>{t('Code mappings')}</Text>
          <Text>
            {t(
              'Tell Sentry how to translate file paths, so errors open the right line of code.'
            )}
          </Text>
        </Stack>

        <form.AppField name="pathMappings" mode="array">
          {field => {
            const handleDelete = (i: number) => {
              if (form.state.values.pathMappings.length === 1 && !allowEmpty) {
                const id = nextId();
                form.setFieldValue('pathMappings', [newRowValue]);
                setRowIds([id]);
                addUntouchedRow(id);
              } else {
                field.removeValue(i);
                setRowIds(prev => prev.filter((_, idx) => idx !== i));
              }
            };

            const handleAdd = () => {
              const id = nextId();
              field.pushValue(newRowValue);
              setRowIds(prev => [...prev, id]);
              addUntouchedRow(id);
              setAutoFocusId(id);
            };

            return (
              <form.Subscribe selector={state => state.values.pathMappings}>
                {pathMappings => {
                  if (pathMappings.length === 0) {
                    return <PathMappingEmptyState onAdd={handleAdd} />;
                  }

                  // Save is still blocked by any duplicate; this only holds back
                  // the message on rows the user hasn't left yet.
                  const warnings = getPathMappingWarnings(
                    pathMappings,
                    existingMappings,
                    seededById
                  ).map((warning, i) =>
                    untouchedIds.has(rowIds[i]!) ? undefined : warning
                  );
                  const addDisabledReason = hasDuplicateMappings(
                    pathMappings,
                    branchFallback
                  )
                    ? t('Resolve the duplicate path mapping first')
                    : undefined;

                  return (
                    <Fragment>
                      {/* No overflow clipping here: it would cut off the prefix
                          dropdowns. The header rounds its own top corners instead. */}
                      <Container containerType="inline-size" border="muted" radius="md">
                        <PathMappingTableHeader />
                        {pathMappings.map((value, i) => {
                          const fields: `pathMappings[${number}]` = `pathMappings[${i}]`;
                          return (
                            <PathMappingRow
                              // Remount when a row's index changes: TanStack Form's
                              // field groups don't follow `fields` changes.
                              // https://github.com/TanStack/form/issues/1648
                              key={`${rowIds[i]}:${fields}`}
                              form={form}
                              fields={fields}
                              automaticallyGenerated={value.automaticallyGenerated}
                              hasCodeOwner={value.hasCodeOwner}
                              warning={warnings[i]}
                              projectSlug={projectSlug}
                              providerKey={providerKey}
                              repositoryId={repositoryId}
                              defaultBranch={defaultBranch}
                              autoFocus={rowIds[i] === autoFocusId}
                              onLeave={() => markTouched(rowIds[i]!)}
                              onDelete={() => handleDelete(i)}
                            />
                          );
                        })}
                      </Container>

                      <Flex justify="end">
                        <Button
                          size="sm"
                          variant="transparent"
                          icon={<IconAdd />}
                          disabled={Boolean(addDisabledReason)}
                          tooltipProps={{title: addDisabledReason}}
                          onClick={handleAdd}
                        >
                          {t('Add mapping')}
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
