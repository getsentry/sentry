import {useCallback, useMemo, useState} from 'react';
import styled from '@emotion/styled';

import type {SelectKey, SelectOption} from 'sentry/components/core/compactSelect';
import {t} from 'sentry/locale';
import {defined} from 'sentry/utils';
import {AggregationKey, FieldKind, prettifyTagKey} from 'sentry/utils/fields';
import {useDebouncedValue} from 'sentry/utils/useDebouncedValue';
import {AttributeDetails} from 'sentry/views/explore/components/attributeDetails';
import {
  ToolbarFooter,
  ToolbarSection,
} from 'sentry/views/explore/components/toolbar/styles';
import {
  ToolbarGroupByAddGroupBy,
  ToolbarGroupByDropdown,
  ToolbarGroupByHeader,
} from 'sentry/views/explore/components/toolbar/toolbarGroupBy';
import {
  ToolbarVisualizeAddChart,
  ToolbarVisualizeDropdown,
  ToolbarVisualizeHeader,
} from 'sentry/views/explore/components/toolbar/toolbarVisualize';
import {TypeBadge} from 'sentry/views/explore/components/typeBadge';
import {DragNDropContext} from 'sentry/views/explore/contexts/dragNDropContext';
import {
  TraceItemAttributeProvider,
  useTraceItemAttributes,
} from 'sentry/views/explore/contexts/traceItemAttributeContext';
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
import {Mode} from 'sentry/views/explore/queryParams/mode';
import {
  isVisualizeFunction,
  MAX_VISUALIZES,
  VisualizeFunction,
  type Visualize,
} from 'sentry/views/explore/queryParams/visualize';
import {TraceItemDataset} from 'sentry/views/explore/types';

import {HiddenLogSearchFields} from './constants';

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

export function LogsToolbar() {
  return (
    <Container data-test-id="logs-toolbar">
      <LogsToolbarVisualizeWrapper />
      <LogsToolbarGroupByWrapper />
    </Container>
  );
}

function LogsToolbarVisualizeWrapper() {
  const [search, setSearch] = useState<string | undefined>(undefined);
  const debouncedSearch = useDebouncedValue(search, 200);
  return (
    <TraceItemAttributeProvider
      enabled
      search={debouncedSearch}
      traceItemType={TraceItemDataset.LOGS}
    >
      <ToolbarVisualize onSearch={setSearch} onClose={() => setSearch(undefined)} />
    </TraceItemAttributeProvider>
  );
}

function LogsToolbarGroupByWrapper() {
  const [search, setSearch] = useState<string | undefined>(undefined);
  const debouncedSearch = useDebouncedValue(search, 200);
  return (
    <TraceItemAttributeProvider
      enabled
      search={debouncedSearch}
      traceItemType={TraceItemDataset.LOGS}
    >
      <ToolbarGroupBy onSearch={setSearch} onClose={() => setSearch(undefined)} />
    </TraceItemAttributeProvider>
  );
}

interface LogsToolbarProps {
  onClose: () => void;
  onSearch: (search: string) => void;
}

function ToolbarVisualize({onSearch, onClose}: LogsToolbarProps) {
  const {attributes: stringTags, isLoading: stringTagsLoading} = useTraceItemAttributes(
    'string',
    HiddenLogSearchFields
  );
  const {attributes: numberTags, isLoading: numberTagsLoading} = useTraceItemAttributes(
    'number',
    HiddenLogSearchFields
  );

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

  const visualizes = useQueryParamsVisualizes();
  const setVisualizes = useSetQueryParamsVisualizes();

  const addChart = useCallback(() => {
    const newVisualizes = [...visualizes, new VisualizeFunction('count(message)')].map(
      visualize => visualize.serialize()
    );
    setVisualizes(newVisualizes);
  }, [setVisualizes, visualizes]);

  const replaceOverlay = useCallback(
    (group: number, newVisualize: Visualize) => {
      const newVisualizes = visualizes.map((visualize, i) => {
        if (i === group) {
          return newVisualize.serialize();
        }
        return visualize.serialize();
      });
      setVisualizes(newVisualizes);
    },
    [setVisualizes, visualizes]
  );

  const onDelete = useCallback(
    (group: number) => {
      const newVisualizes = visualizes.toSpliced(group, 1).map(visualize => {
        return visualize.serialize();
      });
      setVisualizes(newVisualizes);
    },
    [setVisualizes, visualizes]
  );

  const canDelete =
    visualizes.filter(visualize => isVisualizeFunction(visualize)).length > 1;

  return (
    <ToolbarSection data-test-id="section-visualizes">
      <ToolbarVisualizeHeader />
      {visualizes.map((visualize, group) => {
        if (isVisualizeFunction(visualize)) {
          return (
            <VisualizeDropdown
              key={group}
              canDelete={canDelete}
              onDelete={() => onDelete(group)}
              onReplace={newVisualize => replaceOverlay(group, newVisualize)}
              visualize={visualize}
              sortedNumberKeys={sortedNumberKeys}
              sortedStringKeys={sortedStringKeys}
              onSearch={onSearch}
              onClose={onClose}
              loading={numberTagsLoading || stringTagsLoading}
            />
          );
        }
        return null;
      })}
      <ToolbarFooter>
        <ToolbarVisualizeAddChart
          add={addChart}
          disabled={visualizes.length >= MAX_VISUALIZES}
        />
      </ToolbarFooter>
    </ToolbarSection>
  );
}

interface VisualizeDropdownProps {
  canDelete: boolean;
  loading: boolean;
  onClose: () => void;
  onDelete: () => void;
  onReplace: (visualize: Visualize) => void;
  onSearch: (search: string) => void;
  sortedNumberKeys: string[];
  sortedStringKeys: string[];
  visualize: VisualizeFunction;
}

function VisualizeDropdown({
  canDelete,
  loading,
  onDelete,
  onReplace,
  onSearch,
  onClose,
  visualize,
  sortedNumberKeys,
  sortedStringKeys,
}: VisualizeDropdownProps) {
  const aggregateOptions: Array<SelectOption<OurLogsAggregate>> = useMemo(() => {
    return LOG_AGGREGATES.map(aggregate => {
      const defaultArgument = getDefaultArgument(
        aggregate.value,
        sortedNumberKeys[0] || null
      );
      return {...aggregate, disabled: !defined(defaultArgument)};
    });
  }, [sortedNumberKeys]);

  const aggregateFunction = visualize.parsedFunction?.name ?? '';
  const aggregateParam = visualize.parsedFunction?.arguments?.[0] ?? '';

  const fieldOptions = useMemo(() => {
    if (aggregateFunction === AggregationKey.COUNT) {
      return [{label: t('logs'), value: OurLogKnownFieldKey.MESSAGE}];
    }

    return aggregateFunction === AggregationKey.COUNT_UNIQUE
      ? [
          ...sortedNumberKeys.map(key => {
            const label = prettifyTagKey(key);
            return {
              label,
              value: key,
              textValue: key,
              trailingItems: <TypeBadge kind={FieldKind.MEASUREMENT} />,
              showDetailsInOverlay: true,
              details: (
                <AttributeDetails
                  column={key}
                  kind={FieldKind.MEASUREMENT}
                  label={label}
                  traceItemType={TraceItemDataset.LOGS}
                />
              ),
            };
          }),
          ...sortedStringKeys.map(key => {
            const label = prettifyTagKey(key);
            return {
              label,
              value: key,
              textValue: key,
              trailingItems: <TypeBadge kind={FieldKind.TAG} />,
              showDetailsInOverlay: true,
              details: (
                <AttributeDetails
                  column={key}
                  kind={FieldKind.TAG}
                  label={label}
                  traceItemType={TraceItemDataset.LOGS}
                />
              ),
            };
          }),
        ].toSorted((a, b) => {
          const aLabel = prettifyTagKey(a.value);
          const bLabel = prettifyTagKey(b.value);
          return aLabel.localeCompare(bLabel);
        })
      : sortedNumberKeys.map(key => {
          const label = prettifyTagKey(key);
          return {
            label,
            value: key,
            textValue: key,
            trailingItems: <TypeBadge kind={FieldKind.MEASUREMENT} />,
            showDetailsInOverlay: true,
            details: (
              <AttributeDetails
                column={key}
                kind={FieldKind.MEASUREMENT}
                label={label}
                traceItemType={TraceItemDataset.LOGS}
              />
            ),
          };
        });
  }, [aggregateFunction, sortedStringKeys, sortedNumberKeys]);

  const onChangeAggregate = useCallback(
    (option: SelectOption<SelectKey>) => {
      if (typeof option.value === 'string') {
        const yAxis = updateVisualizeAggregate({
          newAggregate: option.value,
          oldAggregate: aggregateFunction,
          oldArgument: aggregateParam,
          firstNumberKey: sortedNumberKeys[0] || null,
        });
        onReplace(visualize.replace({yAxis}));
      }
    },
    [onReplace, visualize, aggregateFunction, aggregateParam, sortedNumberKeys]
  );

  const onChangeArgument = useCallback(
    (_index: number, option: SelectOption<SelectKey>) => {
      if (typeof option.value === 'string') {
        const yAxis = `${aggregateFunction}(${option.value})`;
        onReplace(visualize.replace({yAxis}));
      }
    },
    [onReplace, aggregateFunction, visualize]
  );

  return (
    <ToolbarVisualizeDropdown
      aggregateOptions={aggregateOptions}
      fieldOptions={fieldOptions}
      canDelete={canDelete}
      onChangeAggregate={onChangeAggregate}
      onChangeArgument={onChangeArgument}
      onDelete={onDelete}
      parsedFunction={visualize.parsedFunction}
      onClose={onClose}
      onSearch={onSearch}
      loading={loading}
    />
  );
}

function ToolbarGroupBy({onSearch, onClose}: LogsToolbarProps) {
  const {attributes: numberTags, isLoading: numberTagsLoading} = useTraceItemAttributes(
    'number',
    HiddenLogSearchFields
  );
  const {attributes: stringTags, isLoading: stringTagsLoading} = useTraceItemAttributes(
    'string',
    HiddenLogSearchFields
  );
  const groupBys = useQueryParamsGroupBys();
  const setGroupBys = useSetQueryParamsGroupBys();

  const options = useMemo(
    () =>
      [
        {
          label: '\u2014',
          value: '',
          textValue: '\u2014',
        },
        ...Object.keys(numberTags ?? {}).map(key => {
          const label = prettifyTagKey(key);
          return {
            label,
            value: key,
            textValue: key,
            trailingItems: <TypeBadge kind={FieldKind.MEASUREMENT} />,
            showDetailsInOverlay: true,
            details: (
              <AttributeDetails
                column={key}
                kind={FieldKind.MEASUREMENT}
                label={label}
                traceItemType={TraceItemDataset.LOGS}
              />
            ),
          };
        }),
        ...Object.keys(stringTags ?? {}).map(key => {
          const label = prettifyTagKey(key);
          return {
            label,
            value: key,
            textValue: key,
            trailingItems: <TypeBadge kind={FieldKind.TAG} />,
            showDetailsInOverlay: true,
            details: (
              <AttributeDetails
                column={key}
                kind={FieldKind.TAG}
                label={label}
                traceItemType={TraceItemDataset.LOGS}
              />
            ),
          };
        }),
      ].toSorted((a, b) => {
        const aLabel = prettifyTagKey(a.value);
        const bLabel = prettifyTagKey(b.value);
        return aLabel.localeCompare(bLabel);
      }),
    [numberTags, stringTags]
  );

  const setGroupBysWithOp = useCallback(
    (columns: string[], op: 'insert' | 'update' | 'delete' | 'reorder') => {
      // automatically switch to aggregates mode when a group by is inserted/updated
      if (op === 'insert' || op === 'update') {
        setGroupBys(columns, Mode.AGGREGATE);
      } else {
        setGroupBys(columns);
      }
    },
    [setGroupBys]
  );

  return (
    <DragNDropContext columns={groupBys.slice()} setColumns={setGroupBysWithOp}>
      {({editableColumns, insertColumn, updateColumnAtIndex, deleteColumnAtIndex}) => (
        <ToolbarSection data-test-id="section-group-by">
          <ToolbarGroupByHeader />
          {editableColumns.map((column, i) => (
            <ToolbarGroupByDropdown
              key={column.id}
              canDelete={editableColumns.length > 1}
              column={column}
              onColumnChange={c => updateColumnAtIndex(i, c)}
              onColumnDelete={() => deleteColumnAtIndex(i)}
              options={options}
              onSearch={onSearch}
              onClose={onClose}
              loading={numberTagsLoading || stringTagsLoading}
            />
          ))}
          <ToolbarFooter>
            <ToolbarGroupByAddGroupBy add={() => insertColumn('')} disabled={false} />
          </ToolbarFooter>
        </ToolbarSection>
      )}
    </DragNDropContext>
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
  min-width: 300px;
`;
