import {useMemo} from 'react';
import styled from '@emotion/styled';

import type {SelectOption} from 'sentry/components/core/compactSelect';
import {CompactSelect} from 'sentry/components/core/compactSelect';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {TagCollection} from 'sentry/types/group';
import {defined} from 'sentry/utils';
import {AggregationKey, prettifyTagKey} from 'sentry/utils/fields';
import {
  OurLogKnownFieldKey,
  type OurLogsAggregate,
} from 'sentry/views/explore/logs/types';
import {
  useQueryParamsGroupBys,
  useQueryParamsVisualizes,
  useSetQueryParamsGroupBys,
  useSetQueryParamsVisualizes,
} from 'sentry/views/explore/queryParams/context';
import type {VisualizeFunction} from 'sentry/views/explore/queryParams/visualize';
import {isVisualizeFunction} from 'sentry/views/explore/queryParams/visualize';

export const LOG_AGGREGATES: Array<SelectOption<OurLogsAggregate>> = [
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
];

interface LogsToolbarProps {
  numberTags: TagCollection;
  stringTags: TagCollection;
}

export function LogsToolbar({stringTags, numberTags}: LogsToolbarProps) {
  const visualizes = useQueryParamsVisualizes();
  const groupBys = useQueryParamsGroupBys();
  const setVisualizes = useSetQueryParamsVisualizes();
  const setGroupBys = useSetQueryParamsGroupBys();

  const sortedNumberKeys: string[] = useMemo(() => {
    const keys = Object.keys(numberTags);
    keys.sort();
    return keys;
  }, [numberTags]);

  const sortedStringKeys: string[] = useMemo(() => {
    const keys = Object.keys(stringTags);
    keys.sort();
    return keys;
  }, [stringTags]);

  const aggregateOptions: Array<SelectOption<OurLogsAggregate>> = useMemo(() => {
    return LOG_AGGREGATES.map(aggregate => {
      const defaultArgument = getDefaultArgument(
        aggregate.value,
        sortedNumberKeys[0] || null
      );
      return {...aggregate, disabled: !defined(defaultArgument)};
    });
  }, [sortedNumberKeys]);

  return (
    <Container data-test-id="logs-toolbar">
      <ToolbarItem>
        <SectionHeader>
          <Label>{t('Visualize')}</Label>
        </SectionHeader>
        {visualizes
          .filter<VisualizeFunction>(isVisualizeFunction)
          .map((visualize, index) => {
            const aggregateFunction = visualize.parsedFunction?.name ?? 'count';

            const aggregatableKeys =
              aggregateFunction === AggregationKey.COUNT
                ? [{label: t('logs'), value: OurLogKnownFieldKey.MESSAGE}]
                : aggregateFunction === AggregationKey.COUNT_UNIQUE
                  ? sortedStringKeys.map(key => ({
                      label: prettifyTagKey(key),
                      value: key,
                    }))
                  : sortedNumberKeys.map(key => ({
                      label: prettifyTagKey(key),
                      value: key,
                    }));

            const aggregateFn = visualize.parsedFunction?.name ?? '';
            const aggregateParam =
              aggregateFunction === AggregationKey.COUNT
                ? OurLogKnownFieldKey.MESSAGE
                : (visualize.parsedFunction?.arguments?.[0] ?? '');

            function setVisualize(yAxis: string) {
              setVisualizes(
                visualizes.map((v, i) => {
                  return {
                    yAxes: i === index ? [yAxis] : [v.yAxis],
                    chartType: v.selectedChartType,
                  };
                })
              );
            }

            return (
              <ToolbarSelectRow key={index}>
                <Select
                  options={aggregateOptions}
                  onChange={val => {
                    if (typeof val.value === 'string') {
                      const yAxis = updateVisualizeAggregate({
                        newAggregate: val.value,
                        oldAggregate: aggregateFn,
                        oldArgument: aggregateParam,
                        firstNumberKey: sortedNumberKeys[0] || null,
                      });
                      setVisualize(yAxis);
                    }
                  }}
                  value={aggregateFn}
                />
                <SelectRefWrapper>
                  <Select
                    options={aggregatableKeys}
                    onChange={val => {
                      setVisualize(`${aggregateFn}(${val.value})`);
                    }}
                    searchable
                    value={aggregateParam}
                  />
                </SelectRefWrapper>
              </ToolbarSelectRow>
            );
          })}
      </ToolbarItem>
      <ToolbarItem>
        <SectionHeader>
          <Label>{t('Group By')}</Label>
        </SectionHeader>
        {groupBys.map((groupBy, index) => {
          function setGroupBy(newGroupBy: string) {
            setGroupBys(
              groupBys.map((g, i) => {
                return i === index ? newGroupBy : g;
              })
            );
          }
          return (
            <Select
              key={index}
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
              onChange={val => {
                const value: string = val.value ? (val.value as string) : '';
                setGroupBy(value);
              }}
              value={groupBy}
              searchable
              triggerProps={{style: {width: '100%'}}}
            />
          );
        })}
      </ToolbarItem>
    </Container>
  );
}

function updateVisualizeAggregate({
  newAggregate,
  oldAggregate,
  oldArgument,
  firstNumberKey,
}: {
  firstNumberKey: string | null;
  newAggregate: string;
  oldAggregate: string;
  oldArgument: string;
}): string {
  if (newAggregate === AggregationKey.COUNT) {
    return `${AggregationKey.COUNT}(${OurLogKnownFieldKey.MESSAGE})`;
  }

  if (newAggregate === AggregationKey.COUNT_UNIQUE) {
    return `${AggregationKey.COUNT_UNIQUE}(${OurLogKnownFieldKey.MESSAGE})`;
  }

  if (
    oldAggregate === AggregationKey.COUNT ||
    oldAggregate === AggregationKey.COUNT_UNIQUE
  ) {
    return `${newAggregate}(${getDefaultArgument(newAggregate, firstNumberKey) || ''})`;
  }

  return `${newAggregate}(${oldArgument})`;
}

function getDefaultArgument(
  aggregate: string,
  firstNumberKey: string | null
): string | null {
  if (aggregate === AggregationKey.COUNT || aggregate === AggregationKey.COUNT_UNIQUE) {
    return OurLogKnownFieldKey.MESSAGE;
  }

  return firstNumberKey;
}

const Container = styled('div')`
  display: flex;
  flex-direction: column;
  border-right: 1px solid ${p => p.theme.border};
  border-top: 1px solid ${p => p.theme.border};
  padding: ${space(2)};
  gap: ${space(2)};
  background-color: ${p => p.theme.background};

  @media (min-width: ${p => p.theme.breakpoints.md}) {
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
