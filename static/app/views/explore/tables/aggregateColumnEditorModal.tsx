import {Fragment, useCallback, useMemo, useState} from 'react';
import {useSortable} from '@dnd-kit/sortable';
import {CSS} from '@dnd-kit/utilities';
import styled from '@emotion/styled';
import cloneDeep from 'lodash/cloneDeep';

import {SelectTrigger} from '@sentry/scraps/compactSelect/trigger';

import type {ModalRenderProps} from 'sentry/actionCreators/modal';
import {ArithmeticBuilder} from 'sentry/components/arithmeticBuilder';
import type {Expression} from 'sentry/components/arithmeticBuilder/expression';
import type {FunctionArgument} from 'sentry/components/arithmeticBuilder/types';
import {Button} from 'sentry/components/core/button';
import {ButtonBar} from 'sentry/components/core/button/buttonBar';
import {LinkButton} from 'sentry/components/core/button/linkButton';
import type {SelectKey, SelectOption} from 'sentry/components/core/compactSelect';
import {CompactSelect} from 'sentry/components/core/compactSelect';
import {DropdownMenu} from 'sentry/components/dropdownMenu';
import {SPAN_PROPS_DOCS_URL} from 'sentry/constants';
import {IconAdd} from 'sentry/icons/iconAdd';
import {IconDelete} from 'sentry/icons/iconDelete';
import {IconGrabbable} from 'sentry/icons/iconGrabbable';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {TagCollection} from 'sentry/types/group';
import type {Organization} from 'sentry/types/organization';
import {
  EQUATION_PREFIX,
  parseFunction,
  stripEquationPrefix,
} from 'sentry/utils/discover/fields';
import {
  ALLOWED_EXPLORE_VISUALIZE_AGGREGATES,
  FieldKind,
  getFieldDefinition,
} from 'sentry/utils/fields';
import useOrganization from 'sentry/utils/useOrganization';
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

interface AggregateColumnEditorModalProps extends ModalRenderProps {
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
  numberTags,
  stringTags,
}: AggregateColumnEditorModalProps) {
  const organization = useOrganization();

  // We keep a temporary state for the columns so that we can apply the changes
  // only when the user clicks on the apply button.
  const [tempColumns, setTempColumns] = useState<AggregateField[]>(columns);

  const groupBys = useMemo(() => {
    return columns.filter(isGroupBy).map(groupBy => groupBy.groupBy);
  }, [columns]);

  const handleApply = useCallback(() => {
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
  }, [closeModal, onColumnsChange, tempColumns]);

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
                  key={column.id}
                  organization={organization}
                  canDelete={
                    isGroupBy(column.column) ? canDeleteGroupBy : canDeleteVisualize
                  }
                  column={column}
                  options={[]}
                  onColumnChange={c => updateColumnAtIndex(i, c)}
                  onColumnDelete={() => deleteColumnAtIndex(i)}
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
                  ...(organization.features.includes('visibility-explore-equations')
                    ? [
                        {
                          key: 'add-equation',
                          label: t('Equation'),
                          details: t('ex. p50(span.duration) / 2'),
                          disabled: !canAddVisualize,
                          onAction: () =>
                            insertColumn(new VisualizeEquation(EQUATION_PREFIX)),
                        },
                      ]
                    : []),
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
            <ButtonBar>
              <LinkButton priority="default" href={SPAN_PROPS_DOCS_URL} external>
                {t('Read the Docs')}
              </LinkButton>
              <Button aria-label={t('Apply')} priority="primary" onClick={handleApply}>
                {t('Apply')}
              </Button>
            </ButtonBar>
          </Footer>
        </Fragment>
      )}
    </DragNDropContext>
  );
}

interface ColumnEditorRowProps {
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
      <StyledButton
        aria-label={t('Drag to reorder')}
        borderless
        size="sm"
        icon={<IconGrabbable size="sm" />}
        {...listeners}
      />
      {isGroupBy(column.column) ? (
        <GroupBySelector
          groupBy={column.column}
          groupBys={groupBys}
          numberTags={numberTags}
          onChange={onColumnChange}
          stringTags={stringTags}
        />
      ) : (
        <VisualizeSelector
          organization={organization}
          visualize={column.column}
          onChange={onColumnChange}
          numberTags={numberTags}
          stringTags={stringTags}
        />
      )}
      <StyledButton
        aria-label={t('Remove Column')}
        borderless
        disabled={!canDelete}
        size="sm"
        icon={<IconDelete size="sm" />}
        onClick={onColumnDelete}
      />
    </RowContainer>
  );
}

interface GroupBySelectorProps {
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
}: GroupBySelectorProps) {
  const options: Array<SelectOption<string>> = useGroupByFields({
    groupBys,
    numberTags,
    stringTags,
    traceItemType: TraceItemDataset.SPANS,
  });

  const label = useMemo(() => {
    const tag = options.find(option => option.value === groupBy.groupBy);
    return <TriggerLabel>{tag?.label ?? groupBy.groupBy}</TriggerLabel>;
  }, [groupBy.groupBy, options]);

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
      searchable
      trigger={triggerProps => (
        <SelectTrigger.Button
          {...triggerProps}
          prefix={t('Group By')}
          style={{
            width: '100%',
          }}
        >
          {label}
        </SelectTrigger.Button>
      )}
    />
  );
}

interface VisualizeSelectorProps {
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

  const argumentOptions: Array<SelectOption<string>> = useVisualizeFields({
    numberTags,
    stringTags,
    parsedFunction,
    traceItemType: TraceItemDataset.SPANS,
  });

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

  const handleArgumentChange = useCallback(
    (index: number, option: SelectOption<SelectKey>) => {
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
    },
    [parsedFunction, onChange, visualize]
  );

  return (
    <Fragment>
      <SingleWidthCompactSelect
        data-test-id="editor-visualize-function"
        options={aggregateOptions}
        value={parsedFunction?.name}
        onChange={handleFunctionChange}
        searchable
        trigger={triggerProps => (
          <SelectTrigger.Button
            {...triggerProps}
            prefix={t('Function')}
            style={{
              width: '100%',
            }}
          />
        )}
      />
      {aggregateDefinition?.parameters?.map((param, index) => {
        return (
          <DoubleWidthCompactSelect
            key={param.name}
            data-test-id="editor-visualize-argument"
            options={argumentOptions}
            value={parsedFunction?.arguments[index] ?? param.defaultValue ?? ''}
            onChange={option => handleArgumentChange(index, option)}
            searchable
            disabled={argumentOptions.length === 1}
            trigger={triggerProps => (
              <SelectTrigger.Button
                {...triggerProps}
                style={{
                  width: '100%',
                }}
              />
            )}
          />
        );
      })}
      {aggregateDefinition?.parameters?.length === 0 && (
        <DoubleWidthCompactSelect
          data-test-id="editor-visualize-argument"
          options={argumentOptions}
          value={parsedFunction?.arguments[0] ?? ''}
          onChange={option => handleArgumentChange(0, option)}
          searchable
          disabled
          trigger={triggerProps => (
            <SelectTrigger.Button
              {...triggerProps}
              style={{
                width: '100%',
              }}
            />
          )}
        />
      )}
    </Fragment>
  );
}

function EquationSelector({
  numberTags,
  stringTags,
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
  gap: ${space(1)};

  :not(:first-child) {
    margin-top: ${space(1)};
  }
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
