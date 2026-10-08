import {useCallback, useMemo, useState} from 'react';
import styled from '@emotion/styled';
import {useDebouncedValue} from '@tanstack/react-pacer';
import cloneDeep from 'lodash/cloneDeep';

import type {SelectKey, SelectOption} from '@sentry/scraps/compactSelect';

import {t} from 'sentry/locale';
import type {TagCollection} from 'sentry/types/group';
import {defined} from 'sentry/utils/defined';
import {AggregationKey} from 'sentry/utils/fields';
import {useOrganization} from 'sentry/utils/useOrganization';
import {ConditionalAggregateFilterBar} from 'sentry/views/explore/components/conditionalAggregateFilterBar';
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
import {DragNDropContext} from 'sentry/views/explore/contexts/dragNDropContext';
import {useGroupByFields} from 'sentry/views/explore/hooks/useGroupByFields';
import {useLogItemAttributes} from 'sentry/views/explore/hooks/useTraceItemAttributes';
import {useValidatedGroupBys} from 'sentry/views/explore/hooks/useValidatedGroupBys';
import {useVisualizeFields} from 'sentry/views/explore/hooks/useVisualizeFields';
import {
  OurLogKnownFieldKey,
  type OurLogsAggregate,
} from 'sentry/views/explore/logs/types';
import {useValidateLogsTab} from 'sentry/views/explore/logs/useValidateLogsTab';
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
import {
  applyConditionalFilter,
  buildConditionalAggregate,
  parseConditionalAggregate,
  supportsConditionalAggregateFilter,
} from 'sentry/views/explore/utils/conditionalAggregate';
import {
  mergeValidatedGroupByTags,
  shouldHideGroupByForValidation,
} from 'sentry/views/explore/utils/groupByValidation';

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
      <ToolbarVisualize />
      <ToolbarGroupBy />
    </Container>
  );
}

function ToolbarVisualize() {
  const [search, setSearch] = useState<string | undefined>(undefined);
  const [debouncedSearch] = useDebouncedValue(search, {wait: 200});

  const {attributes: stringTags, isLoading: stringTagsLoading} = useLogItemAttributes(
    {search: debouncedSearch},
    'string',
    HiddenLogSearchFields
  );
  const {attributes: numberTags, isLoading: numberTagsLoading} = useLogItemAttributes(
    {search: debouncedSearch},
    'number',
    HiddenLogSearchFields
  );
  const {attributes: booleanTags, isLoading: booleanTagsLoading} = useLogItemAttributes(
    {search: debouncedSearch},
    'boolean',
    HiddenLogSearchFields
  );

  const onSearch = setSearch;
  const onClose = useCallback(() => setSearch(undefined), []);

  const visualizes = useQueryParamsVisualizes();
  const setVisualizes = useSetQueryParamsVisualizes();

  const addChart = useCallback(() => {
    const newVisualizes = [...visualizes, new VisualizeFunction('count(message)')].map(
      visualize => visualize.serialize()
    );
    setVisualizes(newVisualizes);
  }, [setVisualizes, visualizes]);

  const replaceOverlay = (group: number, newVisualize: Visualize) => {
    const newVisualizes = visualizes.map((visualize, i) => {
      if (i === group) {
        return newVisualize.serialize();
      }
      return visualize.serialize();
    });
    setVisualizes(newVisualizes);
  };

  const handleDelete = useCallback(
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
          const onDelete = canDelete ? () => handleDelete(group) : undefined;
          return (
            <VisualizeDropdown
              key={group}
              onDelete={onDelete}
              onReplace={newVisualize => replaceOverlay(group, newVisualize)}
              visualize={visualize}
              booleanTags={booleanTags}
              numberTags={numberTags}
              stringTags={stringTags}
              onSearch={onSearch}
              onClose={onClose}
              loading={numberTagsLoading || stringTagsLoading || booleanTagsLoading}
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
  booleanTags: TagCollection;
  loading: boolean;
  numberTags: TagCollection;
  onClose: () => void;
  onReplace: (visualize: Visualize) => void;
  onSearch: (search: string) => void;
  stringTags: TagCollection;
  visualize: VisualizeFunction;
  onDelete?: () => void;
}

function VisualizeDropdown({
  loading,
  onDelete,
  onReplace,
  onSearch,
  onClose,
  visualize,
  booleanTags,
  numberTags,
  stringTags,
}: VisualizeDropdownProps) {
  const organization = useOrganization();
  const hasConditionalAggregates = organization.features.includes(
    'explore-conditional-aggregates'
  );

  const firstNumberKey = useMemo(
    () => Object.keys(numberTags).sort()[0] ?? null,
    [numberTags]
  );

  const aggregateOptions: Array<SelectOption<OurLogsAggregate>> = useMemo(() => {
    return LOG_AGGREGATES.map(aggregate => {
      const defaultArgument = getDefaultArgument(aggregate.value, firstNumberKey);
      return {...aggregate, disabled: !defined(defaultArgument)};
    });
  }, [firstNumberKey]);

  // Dropdowns operate on the base aggregate; strip the `_if` combinator and filter.
  const parsedFunction = useMemo(
    () => parseConditionalAggregate(visualize.yAxis),
    [visualize.yAxis]
  );

  const filter = useMemo(
    () => (hasConditionalAggregates ? (parsedFunction?.filter ?? '') : ''),
    [hasConditionalAggregates, parsedFunction?.filter]
  );

  const fieldOptions = useVisualizeFields({
    numberTags,
    stringTags,
    booleanTags,
    parsedFunction,
    traceItemType: TraceItemDataset.LOGS,
  });

  const onChangeAggregate = useCallback(
    (option: SelectOption<SelectKey>) => {
      if (typeof option.value === 'string') {
        const yAxis = updateVisualizeAggregate({
          newAggregate: option.value,
          oldAggregate: parsedFunction?.name ?? '',
          oldArgument: parsedFunction?.arguments?.[0] ?? '',
          firstNumberKey,
        });
        onReplace(
          visualize.replace({
            yAxis: supportsConditionalAggregateFilter(option.value)
              ? applyConditionalFilter(yAxis, filter)
              : yAxis,
          })
        );
      }
    },
    [filter, firstNumberKey, onReplace, parsedFunction, visualize]
  );

  const onChangeArgument = useCallback(
    (index: number, option: SelectOption<SelectKey>) => {
      if (typeof option.value === 'string') {
        let args = cloneDeep(parsedFunction?.arguments);
        if (args) {
          args[index] = option.value;
        } else {
          args = [option.value];
        }
        onReplace(
          visualize.replace({
            yAxis: buildConditionalAggregate({
              name: parsedFunction?.name ?? '',
              arguments: args,
              filter,
            }),
          })
        );
      }
    },
    [filter, onReplace, parsedFunction, visualize]
  );

  const onFilterSearch = useCallback(
    (newFilter: string) => {
      if (!parsedFunction) {
        return;
      }
      onReplace(
        visualize.replace({
          yAxis: buildConditionalAggregate({
            name: parsedFunction.name,
            arguments: parsedFunction.arguments,
            filter: newFilter,
          }),
        })
      );
    },
    [onReplace, parsedFunction, visualize]
  );

  const showFilterSearchBar =
    hasConditionalAggregates &&
    supportsConditionalAggregateFilter(parsedFunction?.name ?? '');

  return (
    <ToolbarVisualizeDropdown
      aggregateOptions={aggregateOptions}
      fieldOptions={fieldOptions}
      onChangeAggregate={onChangeAggregate}
      onChangeArgument={onChangeArgument}
      onDelete={onDelete}
      parsedFunction={parsedFunction}
      onClose={onClose}
      onSearch={onSearch}
      loading={loading}
      fieldDefinitionType="log"
      filterSearchBar={
        showFilterSearchBar ? (
          <ConditionalAggregateFilterBar
            itemType={TraceItemDataset.LOGS}
            menuPresentation="panel"
            initialQuery={filter}
            onSearch={onFilterSearch}
            searchSource="explore-logs-conditional-aggregate"
          />
        ) : undefined
      }
    />
  );
}

function ToolbarGroupBy() {
  const [search, setSearch] = useState<string | undefined>(undefined);
  const [debouncedSearch] = useDebouncedValue(search, {wait: 200});

  const {attributes: numberTags, isLoading: numberTagsLoading} = useLogItemAttributes(
    {search: debouncedSearch},
    'number',
    HiddenLogSearchFields
  );
  const {attributes: stringTags, isLoading: stringTagsLoading} = useLogItemAttributes(
    {search: debouncedSearch},
    'string',
    HiddenLogSearchFields
  );
  const {attributes: booleanTags, isLoading: booleanTagsLoading} = useLogItemAttributes(
    {search: debouncedSearch},
    'boolean',
    HiddenLogSearchFields
  );

  const onSearch = setSearch;
  const onClose = useCallback(() => setSearch(undefined), []);

  const groupBys = useQueryParamsGroupBys();
  const setGroupBys = useSetQueryParamsGroupBys();
  const {
    data: validatedSearchQueryData,
    isFetching: validationFetching,
    isLoading: validationLoading,
    isPlaceholderData: validationIsPlaceholderData,
  } = useValidateLogsTab();
  const validationIsPending =
    validationFetching || validationLoading || validationIsPlaceholderData;

  const cleanupInvalidGroupBys = useCallback(
    (validatedGroupBys: string[]) => {
      if (validatedGroupBys.some(Boolean)) {
        setGroupBys(validatedGroupBys);
      } else {
        setGroupBys(validatedGroupBys, Mode.SAMPLES);
      }
    },
    [setGroupBys]
  );
  const {visibleGroupBys} = useValidatedGroupBys({
    groupBys,
    validationData: validatedSearchQueryData,
    validationIsPending,
    onGroupBysCleanup: cleanupInvalidGroupBys,
  });

  const {validatedBooleanTags, validatedNumberTags, validatedStringTags} = useMemo(
    () =>
      mergeValidatedGroupByTags({
        booleanTags: booleanTags ?? {},
        numberTags: numberTags ?? {},
        stringTags: stringTags ?? {},
        validatedFields: validatedSearchQueryData?.field.filter(
          field => field.valid && groupBys.includes(field.name)
        ),
      }),
    [booleanTags, groupBys, numberTags, stringTags, validatedSearchQueryData?.field]
  );

  const options = useGroupByFields({
    numberTags: validatedNumberTags,
    stringTags: validatedStringTags,
    booleanTags: validatedBooleanTags,
    groupBys: visibleGroupBys,
    traceItemType: TraceItemDataset.LOGS,
  });

  const setGroupBysWithOp = useCallback(
    (columns: string[], op: 'insert' | 'update' | 'delete' | 'reorder') => {
      const hasValidGroupBy = columns.some(Boolean);

      // insert/update keeps aggregate mode while a valid group by exists
      if (op === 'insert' || (op === 'update' && hasValidGroupBy)) {
        setGroupBys(columns, Mode.AGGREGATE);
        return;
      }

      if (hasValidGroupBy) {
        setGroupBys(columns);
      } else {
        // when the last group by is cleared, return to samples table
        setGroupBys(columns, Mode.SAMPLES);
      }
    },
    [setGroupBys]
  );

  return (
    <DragNDropContext columns={groupBys.slice()} setColumns={setGroupBysWithOp}>
      {({editableColumns, insertColumn, updateColumnAtIndex, deleteColumnAtIndex}) => (
        <ToolbarSection data-test-id="section-group-by">
          <ToolbarGroupByHeader />
          {editableColumns.map((column, i) => {
            const displayColumn = shouldHideGroupByForValidation(
              column.column,
              validatedSearchQueryData?.field,
              validationIsPending
            )
              ? {...column, column: ''}
              : column;

            return (
              <ToolbarGroupByDropdown
                key={column.id}
                canDelete={editableColumns.length > 1}
                column={displayColumn}
                onColumnChange={c => updateColumnAtIndex(i, c)}
                onColumnDelete={() => deleteColumnAtIndex(i)}
                options={options}
                groupBys={visibleGroupBys}
                onSearch={onSearch}
                onClose={onClose}
                loading={
                  validationIsPending ||
                  numberTagsLoading ||
                  stringTagsLoading ||
                  booleanTagsLoading
                }
                fieldDefinitionType="log"
              />
            );
          })}
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
