import {Fragment, useCallback, useMemo, useState} from 'react';
import {useSortable} from '@dnd-kit/sortable';
import {CSS} from '@dnd-kit/utilities';
import styled from '@emotion/styled';
import cloneDeep from 'lodash/cloneDeep';

import {Button, LinkButton} from '@sentry/scraps/button';
import type {SelectKey, SelectOption} from '@sentry/scraps/compactSelect';
import {CompactSelect} from '@sentry/scraps/compactSelect';
import {Grid} from '@sentry/scraps/layout';
import {OverlayTrigger} from '@sentry/scraps/overlayTrigger';

import type {ModalRenderProps} from 'sentry/actionCreators/modal';
import {ArithmeticBuilder} from 'sentry/components/arithmeticBuilder';
import type {Expression} from 'sentry/components/arithmeticBuilder/expression';
import type {FunctionArgument} from 'sentry/components/arithmeticBuilder/types';
import {DragReorderButton} from 'sentry/components/dnd/dragReorderButton';
import {DropdownMenu} from 'sentry/components/dropdownMenu';
import {SPAN_PROPS_DOCS_URL} from 'sentry/constants';
import {IconAdd} from 'sentry/icons/iconAdd';
import {IconDelete} from 'sentry/icons/iconDelete';
import {t} from 'sentry/locale';
import type {TagCollection} from 'sentry/types/group';
import type {Organization} from 'sentry/types/organization';
import {
  EQUATION_PREFIX,
  parseFunction,
  stripEquationPrefix,
} from 'sentry/utils/discover/fields';
import {
  ALLOWED_EXPLORE_VISUALIZE_AGGREGATES,
  AggregationKey,
  FieldKind,
  getFieldDefinition,
  NO_ARGUMENT_SPAN_AGGREGATES,
} from 'sentry/utils/fields';
import {useDebouncedValue} from 'sentry/utils/useDebouncedValue';
import {useOrganization} from 'sentry/utils/useOrganization';
import {EXPLORE_FIVE_MIN_STALE_TIME} from 'sentry/views/explore/constants';
import {DragNDropContext} from 'sentry/views/explore/contexts/dragNDropContext';
import type {GroupBy} from 'sentry/views/explore/contexts/pageParamsContext/aggregateFields';
import {
  isGroupBy,
  isVisualize,
} from 'sentry/views/explore/contexts/pageParamsContext/aggregateFields';
import {
  DEFAULT_VISUALIZATION,
  updateVisualizeAggregate,
} from 'sentry/views/explore/contexts/pageParamsContext/visualizes';
import type {Column} from 'sentry/views/explore/hooks/useDragNDropColumns';
import {useExploreSuggestedAttribute} from 'sentry/views/explore/hooks/useExploreSuggestedAttribute';
import {useGroupByFields} from 'sentry/views/explore/hooks/useGroupByFields';
import {useSpanItemAttributes} from 'sentry/views/explore/hooks/useTraceItemAttributes';
import {useVisualizeFields} from 'sentry/views/explore/hooks/useVisualizeFields';
import type {
  AggregateField,
  WritableAggregateField,
} from 'sentry/views/explore/queryParams/aggregateField';
import {
  isVisualizeEquation,
  MAX_VISUALIZES,
  Visualize,
  VisualizeEquation,
  VisualizeFunction,
} from 'sentry/views/explore/queryParams/visualize';
import {TraceItemDataset} from 'sentry/views/explore/types';
import {sortSearchedAttributes} from 'sentry/views/explore/utils/sortSearchedAttributes';

interface AggregateColumnEditorModalProps extends ModalRenderProps {
  booleanTags: TagCollection;
  columns: AggregateField[];
  numberTags: TagCollection;
  onColumnsChange: (columns: WritableAggregateField[]) => void;
  stringTags: TagCollection;
}

export function AggregateColumnEditorModal({
  Header,
  Body,
  Footer,
  closeModal,
  columns,
  onColumnsChange,
  booleanTags,
  numberTags,
  stringTags,
}: AggregateColumnEditorModalProps) {
  const organization = useOrganization();

  // We keep a temporary state for the columns so that we can apply the changes
  // only when the user clicks on the apply button.
  const [tempColumns, setTempColumns] = useState(columns);

  const groupBys = useMemo(() => {
    return columns.filter(isGroupBy).map(groupBy => groupBy.groupBy);
  }, [columns]);

  const handleApply = () => {
    const newColumns: WritableAggregateField[] = [];

    for (const col of tempColumns) {
      if (isGroupBy(col)) {
        newColumns.push(col);
      } else if (isVisualize(col)) {
        newColumns.push(col.serialize());
      }
    }

    onColumnsChange(newColumns);
    closeModal();
  };

  const groupByColumnss = tempColumns.filter(isGroupBy);
  const visualizeColumns = tempColumns.filter(isVisualize);

  const canDeleteGroupBy = groupByColumnss.length > 1;
  const canDeleteVisualize = visualizeColumns.length > 1;
  const canAddVisualize = visualizeColumns.length < MAX_VISUALIZES;

  return (
    <DragNDropContext columns={tempColumns} setColumns={setTempColumns}>
      {({insertColumn, updateColumnAtIndex, deleteColumnAtIndex, editableColumns}) => (
        <Fragment>
          <Header closeButton data-test-id="editor-header">
            <h4>{t('Edit Table')}</h4>
          </Header>
          <Body data-test-id="editor-body">
            {editableColumns.map((column, i) => {
              return (
                <ColumnEditorRow
                  key={column.uniqueId}
                  organization={organization}
                  canDelete={
                    isGroupBy(column.column) ? canDeleteGroupBy : canDeleteVisualize
                  }
                  column={column}
                  options={[]}
                  onColumnChange={c => updateColumnAtIndex(i, c)}
                  onColumnDelete={() => deleteColumnAtIndex(i)}
                  booleanTags={booleanTags}
                  numberTags={numberTags}
                  stringTags={stringTags}
                  groupBys={groupBys}
                />
              );
            })}
            <RowContainer>
              <DropdownMenu
                items={[
                  {
                    key: 'add-group-by',
                    label: t('Group By / Attribute'),
                    details: t('ex. browser, device, release'),
                    onAction: () => insertColumn({groupBy: ''}),
                  },
                  {
                    key: 'add-visualize',
                    label: t('Visualize / Function'),
                    details: t('ex. p50(span.duration)'),
                    disabled: !canAddVisualize,
                    onAction: () =>
                      insertColumn(new VisualizeFunction(DEFAULT_VISUALIZATION)),
                  },
                  {
                    key: 'add-equation',
                    label: t('Equation'),
                    details: t('ex. p50(span.duration) / 2'),
                    disabled: !canAddVisualize,
                    onAction: () => insertColumn(new VisualizeEquation(EQUATION_PREFIX)),
                  },
                ]}
                trigger={triggerProps => (
                  <Button
                    {...triggerProps}
                    aria-label={t('Add a Column')}
                    icon={<IconAdd />}
                  >
                    {t('Add a Column')}
                  </Button>
                )}
              />
            </RowContainer>
          </Body>
          <Footer data-test-id="editor-footer">
            <Grid flow="column" align="center" gap="md">
              <LinkButton variant="secondary" href={SPAN_PROPS_DOCS_URL} external>
                {t('Read the Docs')}
              </LinkButton>
              <Button aria-label={t('Apply')} variant="primary" onClick={handleApply}>
                {t('Apply')}
              </Button>
            </Grid>
          </Footer>
        </Fragment>
      )}
    </DragNDropContext>
  );
}

interface ColumnEditorRowProps {
  booleanTags: TagCollection;
  canDelete: boolean;
  column: Column<AggregateField>;
  groupBys: string[];
  numberTags: TagCollection;
  onColumnChange: (column: AggregateField) => void;
  onColumnDelete: () => void;
  options: Array<SelectOption<string>>;
  organization: Organization;
  stringTags: TagCollection;
}

function ColumnEditorRow({
  organization,
  canDelete,
  column,
  groupBys,
  onColumnChange,
  onColumnDelete,
  numberTags,
  stringTags,
  booleanTags,
}: ColumnEditorRowProps) {
  const {attributes, listeners, setNodeRef, transform, transition} = useSortable({
    id: column.id,
  });

  return (
    <RowContainer
      data-test-id="editor-row"
      key={column.id}
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
      }}
      {...attributes}
    >
      <StyledDragReorderButton size="sm" iconSize="sm" {...listeners} />
      {isGroupBy(column.column) ? (
        <GroupBySelector
          groupBy={column.column}
          groupBys={groupBys}
          numberTags={numberTags}
          onChange={onColumnChange}
          stringTags={stringTags}
          booleanTags={booleanTags}
        />
      ) : (
        <VisualizeSelector
          organization={organization}
          visualize={column.column}
          onChange={onColumnChange}
          booleanTags={booleanTags}
          numberTags={numberTags}
          stringTags={stringTags}
        />
      )}
      <StyledButton
        aria-label={t('Remove Column')}
        variant="transparent"
        disabled={!canDelete}
        size="sm"
        icon={<IconDelete size="sm" />}
        onClick={onColumnDelete}
      />
    </RowContainer>
  );
}

interface GroupBySelectorProps {
  booleanTags: TagCollection;
  groupBy: GroupBy;
  groupBys: string[];
  numberTags: TagCollection;
  onChange: (groupBy: GroupBy) => void;
  stringTags: TagCollection;
}

function GroupBySelector({
  groupBy,
  groupBys,
  numberTags,
  onChange,
  stringTags,
  booleanTags,
}: GroupBySelectorProps) {
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search, 250);
  const hasSearch = debouncedSearch.length > 0;

  const {attributes: searchedStringTags, isLoading: stringLoading} =
    useSpanItemAttributes(
      {
        search: debouncedSearch,
        enabled: hasSearch,
        staleTime: EXPLORE_FIVE_MIN_STALE_TIME,
      },
      'string'
    );
  const {attributes: searchedNumberTags, isLoading: numberLoading} =
    useSpanItemAttributes(
      {
        search: debouncedSearch,
        enabled: hasSearch,
        staleTime: EXPLORE_FIVE_MIN_STALE_TIME,
      },
      'number'
    );
  const {attributes: searchedBooleanTags, isLoading: booleanLoading} =
    useSpanItemAttributes(
      {
        search: debouncedSearch,
        enabled: hasSearch,
        staleTime: EXPLORE_FIVE_MIN_STALE_TIME,
      },
      'boolean'
    );

  const isSearchLoading = hasSearch && (stringLoading || numberLoading || booleanLoading);

  const baseOptions = useGroupByFields({
    groupBys,
    numberTags,
    stringTags,
    booleanTags,
    traceItemType: TraceItemDataset.SPANS,
  });

  const searchedOptions = useGroupByFields({
    groupBys: [],
    numberTags: searchedNumberTags,
    stringTags: searchedStringTags,
    booleanTags: searchedBooleanTags,
    traceItemType: TraceItemDataset.SPANS,
    hideEmptyOption: true,
  });

  // Always feed baseOptions to CompactSelect so its built-in matcher can filter
  // synchronously while the user types. Merge in any server-only matches once
  // the debounced search returns.
  const options = useMemo(() => {
    if (!hasSearch || searchedOptions.length === 0) return baseOptions;
    const baseValues = new Set(baseOptions.map(o => o.value));
    const additions = searchedOptions.filter(o => !baseValues.has(o.value));
    if (additions.length === 0) return baseOptions;
    return [...baseOptions, ...additions];
  }, [hasSearch, baseOptions, searchedOptions]);

  const label = useMemo(() => {
    const tag =
      options.find(option => option.value === groupBy.groupBy) ??
      baseOptions.find(option => option.value === groupBy.groupBy);
    return <TriggerLabel>{tag?.label ?? groupBy.groupBy}</TriggerLabel>;
  }, [groupBy.groupBy, options, baseOptions]);

  const handleChange = useCallback(
    (option: SelectOption<SelectKey>) => {
      onChange({groupBy: option.value as string});
    },
    [onChange]
  );

  return (
    <SingleWidthCompactSelect
      data-test-id="editor-groupby"
      options={options}
      value={groupBy.groupBy}
      onChange={handleChange}
      search={{
        onChange: setSearch,
        filter: (option, searchText) => {
          return sortSearchedAttributes({
            fieldDefinitionType: TraceItemDataset.SPANS,
            option,
            searchText,
          });
        },
      }}
      loading={isSearchLoading}
      emptyMessage={isSearchLoading ? t('Loading…') : t('No matching attributes')}
      trigger={triggerProps => (
        <OverlayTrigger.Button
          {...triggerProps}
          prefix={t('Group By')}
          style={{
            width: '100%',
          }}
        >
          {label}
        </OverlayTrigger.Button>
      )}
    />
  );
}

interface VisualizeSelectorProps {
  booleanTags: TagCollection;
  numberTags: TagCollection;
  onChange: (visualize: Visualize) => void;
  organization: Organization;
  stringTags: TagCollection;
  visualize: Visualize;
}

function VisualizeSelector(props: VisualizeSelectorProps) {
  if (isVisualizeEquation(props.visualize)) {
    return <EquationSelector {...props} />;
  }

  return <AggregateSelector {...props} />;
}

function AggregateSelector({
  onChange,
  numberTags,
  stringTags,
  booleanTags,
  visualize,
}: VisualizeSelectorProps) {
  const yAxis = visualize.yAxis;
  const parsedFunction = useMemo(() => parseFunction(yAxis), [yAxis]);
  const aggregateFunc = parsedFunction?.name;
  const aggregateDefinition = aggregateFunc
    ? getFieldDefinition(aggregateFunc, 'span')
    : undefined;

  const aggregateOptions: Array<SelectOption<string>> = useMemo(() => {
    return ALLOWED_EXPLORE_VISUALIZE_AGGREGATES.map(aggregate => {
      return {
        label: aggregate,
        value: aggregate,
        textValue: aggregate,
      };
    });
  }, []);

  const handleFunctionChange = useCallback(
    (option: SelectOption<SelectKey>) => {
      const newYAxis = updateVisualizeAggregate({
        newAggregate: option.value as string,
        oldAggregate: parsedFunction?.name,
        oldArguments: parsedFunction?.arguments,
      });
      onChange(visualize.replace({yAxis: newYAxis}));
    },
    [parsedFunction, onChange, visualize]
  );

  const handleArgumentChange = (index: number, option: SelectOption<SelectKey>) => {
    if (typeof option.value === 'string') {
      let args = cloneDeep(parsedFunction?.arguments);
      if (args) {
        args[index] = option.value;
      } else {
        args = [option.value];
      }
      const newYAxis = `${parsedFunction?.name}(${args.join(',')})`;
      onChange(visualize.replace({yAxis: newYAxis}));
    }
  };

  return (
    <Fragment>
      <SingleWidthCompactSelect
        data-test-id="editor-visualize-function"
        options={aggregateOptions}
        value={parsedFunction?.name}
        onChange={handleFunctionChange}
        search
        trigger={triggerProps => (
          <OverlayTrigger.Button
            {...triggerProps}
            prefix={t('Function')}
            style={{
              width: '100%',
            }}
          />
        )}
      />
      {aggregateDefinition?.parameters?.map((param, index) => (
        <AttributeArgumentSelect
          key={param.name}
          numberTags={numberTags}
          stringTags={stringTags}
          booleanTags={booleanTags}
          parsedFunction={parsedFunction}
          value={parsedFunction?.arguments[index] ?? param.defaultValue ?? ''}
          onChange={option => handleArgumentChange(index, option)}
        />
      ))}
      {aggregateDefinition?.parameters?.length === 0 && (
        <AttributeArgumentSelect
          numberTags={numberTags}
          stringTags={stringTags}
          booleanTags={booleanTags}
          parsedFunction={parsedFunction}
          value={parsedFunction?.arguments[0] ?? ''}
          onChange={option => handleArgumentChange(0, option)}
          forceDisabled
        />
      )}
    </Fragment>
  );
}

interface AttributeArgumentSelectProps {
  booleanTags: TagCollection;
  numberTags: TagCollection;
  onChange: (option: SelectOption<SelectKey>) => void;
  parsedFunction: ReturnType<typeof parseFunction>;
  stringTags: TagCollection;
  value: string;
  forceDisabled?: boolean;
}

function AttributeArgumentSelect({
  numberTags,
  stringTags,
  booleanTags,
  parsedFunction,
  value,
  onChange,
  forceDisabled,
}: AttributeArgumentSelectProps) {
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search, 250);
  const hasSearch = debouncedSearch.length > 0;

  const supportedKinds = getSupportedAttributeKinds(parsedFunction?.name);

  const {attributes: searchedStringTags, isLoading: stringLoading} =
    useSpanItemAttributes(
      {
        search: debouncedSearch,
        enabled: hasSearch && supportedKinds.includes('string'),
        staleTime: EXPLORE_FIVE_MIN_STALE_TIME,
      },
      'string'
    );
  const {attributes: searchedNumberTags, isLoading: numberLoading} =
    useSpanItemAttributes(
      {
        search: debouncedSearch,
        enabled: hasSearch && supportedKinds.includes('number'),
        staleTime: EXPLORE_FIVE_MIN_STALE_TIME,
      },
      'number'
    );
  const {attributes: searchedBooleanTags, isLoading: booleanLoading} =
    useSpanItemAttributes(
      {
        search: debouncedSearch,
        enabled: hasSearch && supportedKinds.includes('boolean'),
        staleTime: EXPLORE_FIVE_MIN_STALE_TIME,
      },
      'boolean'
    );

  const isSearchLoading =
    hasSearch &&
    ((supportedKinds.includes('string') && stringLoading) ||
      (supportedKinds.includes('number') && numberLoading) ||
      (supportedKinds.includes('boolean') && booleanLoading));

  const baseOptions = useVisualizeFields({
    numberTags,
    stringTags,
    booleanTags,
    parsedFunction,
    traceItemType: TraceItemDataset.SPANS,
  });

  const searchedOptions = useVisualizeFields({
    numberTags: searchedNumberTags,
    stringTags: searchedStringTags,
    booleanTags: searchedBooleanTags,
    parsedFunction,
    traceItemType: TraceItemDataset.SPANS,
  });

  // Always feed baseOptions to CompactSelect so its built-in matcher can filter
  // synchronously while the user types. Merge in any server-only matches once
  // the debounced search returns.
  const options = useMemo(() => {
    if (!hasSearch || searchedOptions.length === 0) return baseOptions;
    const baseValues = new Set(baseOptions.map(o => o.value));
    const additions = searchedOptions.filter(o => !baseValues.has(o.value));
    if (additions.length === 0) return baseOptions;
    return [...baseOptions, ...additions];
  }, [hasSearch, baseOptions, searchedOptions]);

  // CompactSelect's default trigger derives its label from the active option
  // list, which can go blank when a search query doesn't match the current
  // value. Match the sibling selectors and fall back to baseOptions, then to
  // the raw value, so the trigger always reflects the current selection.
  const label = useMemo(() => {
    const tag =
      options.find(option => option.value === value) ??
      baseOptions.find(option => option.value === value);
    return <TriggerLabel>{tag?.label ?? value}</TriggerLabel>;
  }, [value, options, baseOptions]);

  return (
    <DoubleWidthCompactSelect
      data-test-id="editor-visualize-argument"
      options={options}
      value={value}
      onChange={onChange}
      search={{
        onChange: setSearch,
        filter: (option, searchText) => {
          return sortSearchedAttributes({
            fieldDefinitionType: TraceItemDataset.SPANS,
            option,
            searchText,
          });
        },
      }}
      loading={isSearchLoading}
      emptyMessage={isSearchLoading ? t('Loading…') : t('No matching attributes')}
      // Stay enabled whenever the function supports server-side search so the
      // user can type to pull additional attributes, even when baseOptions has
      // a single entry (e.g. only one number tag fetched in the initial load).
      disabled={
        forceDisabled || (supportedKinds.length === 0 && baseOptions.length === 1)
      }
      trigger={triggerProps => (
        <OverlayTrigger.Button
          {...triggerProps}
          style={{
            width: '100%',
          }}
        >
          {label}
        </OverlayTrigger.Button>
      )}
    />
  );
}

type AttributeKind = 'string' | 'number' | 'boolean';

function getSupportedAttributeKinds(
  functionName: string | undefined
): readonly AttributeKind[] {
  if (!functionName) return ['number'];
  // COUNT renders a fixed SPAN_DURATION option and ignores tag collections.
  if (functionName === AggregationKey.COUNT) return [];
  if (NO_ARGUMENT_SPAN_AGGREGATES.includes(functionName as AggregationKey)) return [];
  if (functionName === AggregationKey.COUNT_UNIQUE)
    return ['string', 'number', 'boolean'];
  return ['number'];
}

function EquationSelector({
  numberTags,
  stringTags,
  booleanTags,
  onChange,
  visualize,
}: VisualizeSelectorProps) {
  const expression = stripEquationPrefix(visualize.yAxis);

  const functionArguments: FunctionArgument[] = useMemo(() => {
    return [
      ...Object.entries(numberTags).map(([key, tag]) => {
        return {
          kind: FieldKind.MEASUREMENT,
          name: key,
          label: tag.name,
        };
      }),
      ...Object.entries(stringTags).map(([key, tag]) => {
        return {
          kind: FieldKind.TAG,
          name: key,
          label: tag.name,
        };
      }),
    ];
  }, [numberTags, stringTags]);

  const getSpanFieldDefinition = useCallback(
    (key: string) => {
      const tag = numberTags[key] ?? stringTags[key];
      return getFieldDefinition(key, 'span', tag?.kind);
    },
    [numberTags, stringTags]
  );

  const handleExpressionChange = useCallback(
    (newExpression: Expression) => {
      onChange(visualize.replace({yAxis: `${EQUATION_PREFIX}${newExpression.text}`}));
    },
    [onChange, visualize]
  );

  const getSuggestedAttribute = useExploreSuggestedAttribute({
    numberAttributes: numberTags,
    stringAttributes: stringTags,
    booleanAttributes: booleanTags,
  });

  return (
    <ArithmeticBuilder
      data-test-id="editor-visualize-equation"
      aggregations={ALLOWED_EXPLORE_VISUALIZE_AGGREGATES}
      functionArguments={functionArguments}
      getFieldDefinition={getSpanFieldDefinition}
      expression={expression}
      setExpression={handleExpressionChange}
      getSuggestedKey={getSuggestedAttribute}
    />
  );
}

const RowContainer = styled('div')`
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: ${p => p.theme.space.md};

  :not(:first-child) {
    margin-top: ${p => p.theme.space.md};
  }
`;

const StyledDragReorderButton = styled(DragReorderButton)`
  padding-left: 0;
  padding-right: 0;
`;

const StyledButton = styled(Button)`
  padding-left: 0;
  padding-right: 0;
`;

const SingleWidthCompactSelect = styled(CompactSelect)`
  flex: 1;
  min-width: 0;
`;

const DoubleWidthCompactSelect = styled(CompactSelect)`
  flex: 2;
  min-width: 0;
`;

const TriggerLabel = styled('span')`
  display: block;
  width: 100%;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  text-align: left;
  line-height: normal;
  position: relative;
  font-weight: normal;
`;
