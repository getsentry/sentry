import {useRef} from 'react';
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
  useSetLogsPageParams,
} from 'sentry/views/explore/contexts/logs/logsPageParams';
import type {OurLogsAggregate} from 'sentry/views/explore/logs/types';

export const LOG_AGGREGATES = [
  {
    label: t('count'),
    value: AggregationKey.COUNT,
  },
  {
    label: t('count unique'),
    value: AggregationKey.COUNT_UNIQUE,
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
] satisfies Array<{label: string; value: OurLogsAggregate}>;

interface LogsToolbarProps {
  numberTags?: TagCollection;
  stringTags?: TagCollection;
}

export function LogsToolbar({stringTags, numberTags}: LogsToolbarProps) {
  const aggregateFunction = useLogsAggregateFunction();
  let aggregateParam = useLogsAggregateParam();
  const groupBy = useLogsGroupBy();
  const setLogsPageParams = useSetLogsPageParams();
  const functionArgRef = useRef<HTMLDivElement>(null);

  let aggregatableKeys = Object.keys(numberTags ?? {}).map(key => ({
    label: prettifyTagKey(key),
    value: key,
  }));

  if (aggregateFunction === AggregationKey.COUNT) {
    aggregatableKeys = [{label: t('logs'), value: 'logs'}];
    aggregateParam = 'logs';
  }
  if (aggregateFunction === AggregationKey.COUNT_UNIQUE) {
    aggregatableKeys = Object.keys(stringTags ?? {}).map(key => ({
      label: prettifyTagKey(key),
      value: key,
    }));
  }

  return (
    <Container>
      <ToolbarItem>
        <SectionHeader>
          <Label>{t('Visualize')}</Label>
        </SectionHeader>
        <ToolbarSelectRow>
          <Select
            options={LOG_AGGREGATES}
            onChange={val => {
              if (val.value === 'count') {
                setLogsPageParams({
                  aggregateFn: val.value as string | undefined,
                  aggregateParam: null,
                });
              } else {
                setLogsPageParams({aggregateFn: val.value as string | undefined});
                functionArgRef.current?.querySelector('button')?.click();
              }
            }}
            value={aggregateFunction}
          />
          <SelectRefWrapper ref={functionArgRef}>
            <Select
              options={aggregatableKeys}
              onChange={val => {
                if (aggregateFunction !== 'count') {
                  setLogsPageParams({aggregateParam: val.value as string | undefined});
                }
              }}
              searchable
              value={aggregateParam}
            />
          </SelectRefWrapper>
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

const SelectRefWrapper = styled('div')`
  width: 100%;
  min-width: 0;
`;

const Select = styled(CompactSelect)`
  width: 100%;
  min-width: 0;

  > button {
    width: 100%;
  }
`;
