import styled from '@emotion/styled';

import {CompactSelect} from 'sentry/components/core/compactSelect';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {TagCollection} from 'sentry/types/group';
import {AggregationKey, prettifyTagKey} from 'sentry/utils/fields';
import {
  useLogsAggregateFunction,
  useLogsAggregateParam,
  useLogsGroupBy,
  useLogsSortBys,
  useSetLogsPageParams,
  useSetLogsSortBys,
} from 'sentry/views/explore/contexts/logs/logsPageParams';

const TOOLBAR_AGGREGATES = [
  {
    label: t('count'),
    value: AggregationKey.COUNT,
  },
  {
    label: t('sum'),
    value: AggregationKey.SUM,
  },
  {
    label: t('avg'),
    value: AggregationKey.AVG,
  },
  {
    label: t('p50'),
    value: AggregationKey.P50,
  },
  {
    label: t('p75'),
    value: AggregationKey.P75,
  },
  {
    label: t('p90'),
    value: AggregationKey.P90,
  },
  {
    label: t('p95'),
    value: AggregationKey.P95,
  },
  {
    label: t('p99'),
    value: AggregationKey.P99,
  },
  {
    label: t('max'),
    value: AggregationKey.MAX,
  },
  {
    label: t('min'),
    value: AggregationKey.MIN,
  },
];

interface LogsToolbarProps {
  numberTags?: TagCollection;
  stringTags?: TagCollection;
}

export function LogsToolbar({stringTags, numberTags}: LogsToolbarProps) {
  const aggregateFunction = useLogsAggregateFunction();
  const aggregateParam = useLogsAggregateParam() ?? 'logs';
  const sortBys = useLogsSortBys();
  const groupBy = useLogsGroupBy();
  const sortAscending = !sortBys.some(x => x.kind === 'desc');
  const setLogsPageParams = useSetLogsPageParams();
  const setLogsSortBys = useSetLogsSortBys();

  const aggregatableKeys = Object.keys(numberTags ?? {}).map(key => ({
    label: prettifyTagKey(key),
    value: key,
  }));
  if (aggregateFunction === 'count') {
    aggregatableKeys.unshift({label: t('logs'), value: 'logs'});
  }

  return (
    <Container>
      <ToolbarItem>
        <SectionHeader>
          <Label>{t('Visualize')}</Label>
        </SectionHeader>
        <ToolbarSelectRow>
          <Select
            options={TOOLBAR_AGGREGATES}
            onChange={val => {
              if (val.value === 'count') {
                setLogsPageParams({
                  aggregateFn: val.value as string | undefined,
                  aggregateParam: null,
                });
              } else {
                setLogsPageParams({aggregateFn: val.value as string | undefined});
              }
            }}
            value={aggregateFunction}
          />
          <Select
            options={aggregatableKeys}
            onChange={val =>
              setLogsPageParams({aggregateParam: val.value as string | undefined})
            }
            searchable
            value={aggregateParam}
            disabled={aggregateFunction === 'count'}
          />
        </ToolbarSelectRow>
      </ToolbarItem>
      <ToolbarItem>
        <SectionHeader>
          <Label>{t('Group By')}</Label>
        </SectionHeader>
        <Select
          options={[
            {
              label: '\u2014',
              value: '',
              textValue: '\u2014',
            },
            ...Object.keys(stringTags ?? {}).map(key => ({
              label: key,
              value: key,
            })),
          ]}
          onChange={val =>
            setLogsPageParams({groupBy: val.value ? (val.value as string) : null})
          }
          value={groupBy}
          searchable
          triggerProps={{style: {width: '100%'}}}
        />
      </ToolbarItem>
      <ToolbarItem>
        <SectionHeader>
          <Label>{t('Sort By')}</Label>
        </SectionHeader>
        <ToolbarSelectRow>
          <Select
            options={[
              ...Object.keys(stringTags ?? {}),
              ...Object.keys(numberTags ?? {}),
            ].map(key => ({
              label: prettifyTagKey(key),
              value: key,
            }))}
            onChange={val =>
              setLogsSortBys([
                {
                  field: val.value as string,
                  kind: sortAscending ? 'asc' : 'desc',
                },
              ])
            }
            value={sortBys[0]!.field}
            triggerProps={{style: {width: '100%'}}}
          />
          <Select
            options={[
              {
                label: t('asc'),
                value: 'asc',
              },
              {
                label: t('desc'),
                value: 'desc',
              },
            ]}
            value={sortAscending ? 'asc' : 'desc'}
            onChange={val => {
              setLogsSortBys([
                {
                  field: sortBys[0]!.field,
                  kind: val.value === 'desc' ? 'desc' : 'asc',
                },
              ]);
            }}
            searchable
            triggerProps={{style: {width: '100%'}}}
          />
        </ToolbarSelectRow>
      </ToolbarItem>
    </Container>
  );
}

const Container = styled('div')`
  display: flex;
  flex-direction: column;
  border-right: 1px solid ${p => p.theme.border};
  border-top: 1px solid ${p => p.theme.border};
  padding: ${space(2)};
  gap: ${space(2)};
  background-color: ${p => p.theme.background};

  @media (min-width: ${p => p.theme.breakpoints.medium}) {
    padding: ${space(2)} ${space(4)};
  }
`;

const SectionHeader = styled('div')`
  display: flex;
  justify-content: space-between;
  align-items: baseline;
`;

const Label = styled('h5')`
  color: ${p => p.theme.gray500};
  font-size: ${p => p.theme.form.md.fontSize};
  margin: 0;
`;

const ToolbarItem = styled('div')`
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  gap: ${space(1)};
`;

const ToolbarSelectRow = styled('div')`
  display: grid;
  grid-template-columns: minmax(90px, auto) 1fr;
  max-width: 100%;
  gap: ${space(2)};
`;

const Select = styled(CompactSelect)`
  width: 100%;
  min-width: 0;

  > button {
    width: 100%;
  }
`;
