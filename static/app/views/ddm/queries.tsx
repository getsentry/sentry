import {Fragment, useCallback, useLayoutEffect, useMemo} from 'react';
import styled from '@emotion/styled';
import * as echarts from 'echarts/core';

import {Button} from 'sentry/components/button';
import SwitchButton from 'sentry/components/switchButton';
import {Tooltip} from 'sentry/components/tooltip';
import {IconAdd} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {
  type MetricFormulaWidgetParams,
  MetricQueryType,
  type MetricQueryWidgetParams,
  type MetricsQuery,
  type MetricWidgetQueryParams,
} from 'sentry/utils/metrics/types';
import usePageFilters from 'sentry/utils/usePageFilters';
import {DDM_CHART_GROUP} from 'sentry/views/ddm/constants';
import {useDDMContext} from 'sentry/views/ddm/context';
import {FormulaInput} from 'sentry/views/ddm/formulaInput';
import {MetricFormulaContextMenu} from 'sentry/views/ddm/metricFormulaContextMenu';
import {MetricQueryContextMenu} from 'sentry/views/ddm/metricQueryContextMenu';
import {QueryBuilder} from 'sentry/views/ddm/queryBuilder';
import {getQuerySymbol, QuerySymbol} from 'sentry/views/ddm/querySymbol';

export function Queries() {
  const {
    widgets,
    updateWidget,
    setSelectedWidgetIndex,
    showQuerySymbols,
    selectedWidgetIndex,
    isMultiChartMode,
    setIsMultiChartMode,
    addWidget,
    toggleWidgetVisibility,
  } = useDDMContext();

  const {selection} = usePageFilters();

  // Make sure all charts are connected to the same group whenever the widgets definition changes
  useLayoutEffect(() => {
    echarts.connect(DDM_CHART_GROUP);
  }, [widgets]);

  const handleChange = useCallback(
    (index: number, widget: Partial<MetricWidgetQueryParams>) => {
      updateWidget(index, widget);
    },
    [updateWidget]
  );

  const [querySymbols, formulaSymbols] = useMemo(() => {
    const querySymbolSet = new Set<string>();
    const formulaSymbolSet = new Set<string>();
    for (const widget of widgets) {
      const symbol = getQuerySymbol(widget.id);
      if (widget.type === MetricQueryType.QUERY) {
        querySymbolSet.add(symbol);
      } else {
        formulaSymbolSet.add(symbol);
      }
    }
    return [querySymbolSet, formulaSymbolSet];
  }, [widgets]);

  const visibleWidgets = widgets.filter(widget => !widget.isHidden);

  return (
    <Fragment>
      <Wrapper showQuerySymbols={showQuerySymbols}>
        {widgets.map((widget, index) => (
          <Row key={widget.id} onFocusCapture={() => setSelectedWidgetIndex(index)}>
            {widget.type === MetricQueryType.QUERY ? (
              <Query
                widget={widget}
                onChange={handleChange}
                onToggleVisibility={toggleWidgetVisibility}
                index={index}
                projects={selection.projects}
                showQuerySymbols={showQuerySymbols}
                isSelected={index === selectedWidgetIndex}
                canBeHidden={visibleWidgets.length > 1}
              />
            ) : (
              <Formula
                availableVariables={querySymbols}
                formulaVariables={formulaSymbols}
                onChange={handleChange}
                onToggleVisibility={toggleWidgetVisibility}
                index={index}
                widget={widget}
                showQuerySymbols={showQuerySymbols}
                isSelected={index === selectedWidgetIndex}
                canBeHidden={visibleWidgets.length > 1}
              />
            )}
          </Row>
        ))}
      </Wrapper>
      <ButtonBar addQuerySymbolSpacing={showQuerySymbols}>
        <Button
          size="sm"
          icon={<IconAdd isCircled />}
          onClick={() => addWidget(MetricQueryType.QUERY)}
        >
          {t('Add query')}
        </Button>
        <Button
          size="sm"
          icon={<IconAdd isCircled />}
          onClick={() => addWidget(MetricQueryType.FORMULA)}
        >
          {t('Add equation')}
        </Button>
        <SwitchWrapper>
          {t('One chart per query')}
          <SwitchButton
            isActive={isMultiChartMode}
            toggle={() => setIsMultiChartMode(!isMultiChartMode)}
          />
        </SwitchWrapper>
      </ButtonBar>
    </Fragment>
  );
}

interface QueryProps {
  canBeHidden: boolean;
  index: number;
  isSelected: boolean;
  onChange: (index: number, data: Partial<MetricWidgetQueryParams>) => void;
  onToggleVisibility: (index: number) => void;
  projects: number[];
  showQuerySymbols: boolean;
  widget: MetricQueryWidgetParams;
}

function Query({
  widget,
  projects,
  onChange,
  onToggleVisibility,
  index,
  isSelected,
  showQuerySymbols,
  canBeHidden,
}: QueryProps) {
  const metricsQuery = useMemo(
    () => ({
      mri: widget.mri,
      op: widget.op,
      groupBy: widget.groupBy,
      query: widget.query,
    }),
    [widget.groupBy, widget.mri, widget.op, widget.query]
  );

  const handleToggle = useCallback(() => {
    onToggleVisibility(index);
  }, [index, onToggleVisibility]);

  const handleChange = useCallback(
    (data: Partial<MetricsQuery>) => {
      const changes: Partial<MetricQueryWidgetParams> = {...data};
      if (changes.mri || changes.groupBy) {
        changes.focusedSeries = undefined;
      }
      onChange(index, changes);
    },
    [index, onChange]
  );

  const isToggleDisabled = !canBeHidden && !widget.isHidden;

  return (
    <QueryWrapper hasSymbol={showQuerySymbols}>
      {showQuerySymbols && (
        <QueryToggle
          isHidden={widget.isHidden}
          disabled={isToggleDisabled}
          isSelected={isSelected}
          queryId={widget.id}
          onChange={handleToggle}
        />
      )}
      <QueryBuilder
        onChange={handleChange}
        metricsQuery={metricsQuery}
        projects={projects}
      />
      <MetricQueryContextMenu
        displayType={widget.displayType}
        widgetIndex={index}
        metricsQuery={{
          mri: widget.mri,
          query: widget.query,
          op: widget.op,
          groupBy: widget.groupBy,
        }}
      />
    </QueryWrapper>
  );
}

interface FormulaProps {
  availableVariables: Set<string>;
  canBeHidden: boolean;
  formulaVariables: Set<string>;
  index: number;
  isSelected: boolean;
  onChange: (index: number, data: Partial<MetricWidgetQueryParams>) => void;
  onToggleVisibility: (index: number) => void;
  showQuerySymbols: boolean;
  widget: MetricFormulaWidgetParams;
}

function Formula({
  availableVariables,
  formulaVariables,
  index,
  widget,
  onChange,
  onToggleVisibility,
  canBeHidden,
  isSelected,
  showQuerySymbols,
}: FormulaProps) {
  const handleToggle = useCallback(() => {
    onToggleVisibility(index);
  }, [index, onToggleVisibility]);

  const handleChange = useCallback(
    (data: Partial<MetricFormulaWidgetParams>) => {
      onChange(index, data);
    },
    [index, onChange]
  );

  const isToggleDisabled = !canBeHidden && !widget.isHidden;

  return (
    <QueryWrapper hasSymbol={showQuerySymbols}>
      {showQuerySymbols && (
        <QueryToggle
          isHidden={widget.isHidden}
          disabled={isToggleDisabled}
          isSelected={isSelected}
          queryId={widget.id}
          onChange={handleToggle}
        />
      )}
      <FormulaInput
        availableVariables={availableVariables}
        formulaVariables={formulaVariables}
        value={widget.formula}
        onChange={formula => handleChange({formula})}
      />
      <MetricFormulaContextMenu widgetIndex={index} />
    </QueryWrapper>
  );
}

interface QueryToggleProps {
  disabled: boolean;
  isHidden: boolean;
  isSelected: boolean;
  onChange: (isHidden: boolean) => void;
  queryId: number;
}

function QueryToggle({
  isHidden,
  queryId,
  disabled,
  onChange,
  isSelected,
}: QueryToggleProps) {
  let tooltipTitle = isHidden ? t('Show query') : t('Hide query');
  if (disabled) {
    tooltipTitle = t('At least one query must be visible');
  }

  return (
    <Tooltip title={tooltipTitle} delay={500}>
      <StyledQuerySymbol
        isHidden={isHidden}
        queryId={queryId}
        isClickable={!disabled}
        aria-disabled={disabled}
        isSelected={isSelected}
        onClick={disabled ? undefined : () => onChange(!isHidden)}
        role="button"
        aria-label={isHidden ? t('Show query') : t('Hide query')}
      />
    </Tooltip>
  );
}

const QueryWrapper = styled('div')<{hasSymbol: boolean}>`
  display: grid;
  gap: ${space(1)};
  padding-bottom: ${space(1)};
  grid-template-columns: 1fr max-content;
  ${p => p.hasSymbol && `grid-template-columns: min-content 1fr max-content;`}
`;

const StyledQuerySymbol = styled(QuerySymbol)<{isClickable: boolean}>`
  margin-top: 10px;
  cursor: not-allowed;
  ${p => p.isClickable && `cursor: pointer;`}
`;

const Wrapper = styled('div')<{showQuerySymbols: boolean}>``;

const Row = styled('div')`
  display: contents;
`;

const ButtonBar = styled('div')<{addQuerySymbolSpacing: boolean}>`
  align-items: center;
  display: flex;
  padding-bottom: ${space(2)};
  padding-top: ${space(1)};
  gap: ${space(2)};

  ${p =>
    p.addQuerySymbolSpacing &&
    `
    padding-left: ${space(1)};
    margin-left: ${space(2)};
  `}
`;

const SwitchWrapper = styled('label')`
  display: flex;
  margin: 0;
  align-items: center;
  gap: ${space(1)};
`;
