import {Fragment, useCallback, useLayoutEffect, useMemo} from 'react';
import styled from '@emotion/styled';
import * as echarts from 'echarts/core';

import {Button} from 'sentry/components/button';
import SwitchButton from 'sentry/components/switchButton';
import {Tooltip} from 'sentry/components/tooltip';
import {IconAdd} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {trackAnalytics} from 'sentry/utils/analytics';
import {
  type MetricFormulaWidgetParams,
  MetricQueryType,
  type MetricQueryWidgetParams,
  type MetricsQuery,
  type MetricWidgetQueryParams,
} from 'sentry/utils/metrics/types';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';
import {DDM_CHART_GROUP} from 'sentry/views/metrics/constants';
import {useMetricsContext} from 'sentry/views/metrics/context';
import {EquationSymbol} from 'sentry/views/metrics/equationSymbol copy';
import {FormulaInput} from 'sentry/views/metrics/formulaInput';
import {MetricFormulaContextMenu} from 'sentry/views/metrics/metricFormulaContextMenu';
import {MetricQueryContextMenu} from 'sentry/views/metrics/metricQueryContextMenu';
import {QueryBuilder} from 'sentry/views/metrics/queryBuilder';
import {getQuerySymbol, QuerySymbol} from 'sentry/views/metrics/querySymbol';
import {useFormulaDependencies} from 'sentry/views/metrics/utils/useFormulaDependencies';

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
  } = useMetricsContext();

  const organization = useOrganization();
  const {selection} = usePageFilters();
  const formulaDependencies = useFormulaDependencies();

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

  const handleAddWidget = useCallback(
    (type: MetricQueryType) => {
      trackAnalytics('ddm.widget.add', {
        organization,
        type: type === MetricQueryType.QUERY ? 'query' : 'equation',
      });
      addWidget(type);
    },
    [addWidget, organization]
  );

  const querySymbols = useMemo(() => {
    const querySymbolSet = new Set<string>();
    for (const widget of widgets) {
      const symbol = getQuerySymbol(widget.id);
      if (widget.type === MetricQueryType.QUERY) {
        querySymbolSet.add(symbol);
      }
    }
    return querySymbolSet;
  }, [widgets]);

  const visibleWidgets = widgets.filter(widget => !widget.isHidden);

  return (
    <Fragment>
      <Wrapper showQuerySymbols={showQuerySymbols}>
        {widgets.map((widget, index) => (
          <Row
            key={`${widget.type}_${widget.id}`}
            onFocusCapture={() => setSelectedWidgetIndex(index)}
          >
            {widget.type === MetricQueryType.QUERY ? (
              <Query
                widget={widget}
                onChange={handleChange}
                onToggleVisibility={toggleWidgetVisibility}
                index={index}
                projects={selection.projects}
                showQuerySymbols={showQuerySymbols}
                isSelected={isMultiChartMode && index === selectedWidgetIndex}
                canBeHidden={visibleWidgets.length > 1}
              />
            ) : (
              <Formula
                availableVariables={querySymbols}
                onChange={handleChange}
                onToggleVisibility={toggleWidgetVisibility}
                index={index}
                widget={widget}
                showQuerySymbols={showQuerySymbols}
                isSelected={isMultiChartMode && index === selectedWidgetIndex}
                canBeHidden={visibleWidgets.length > 1}
                formulaDependencies={formulaDependencies}
              />
            )}
          </Row>
        ))}
      </Wrapper>
      <ButtonBar addQuerySymbolSpacing={showQuerySymbols}>
        <Button
          size="sm"
          icon={<IconAdd isCircled />}
          onClick={() => handleAddWidget(MetricQueryType.QUERY)}
        >
          {t('Add query')}
        </Button>
        <Button
          size="sm"
          icon={<IconAdd isCircled />}
          onClick={() => handleAddWidget(MetricQueryType.FORMULA)}
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
          type={MetricQueryType.QUERY}
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
  formulaDependencies: ReturnType<typeof useFormulaDependencies>;
  index: number;
  isSelected: boolean;
  onChange: (index: number, data: Partial<MetricWidgetQueryParams>) => void;
  onToggleVisibility: (index: number) => void;
  showQuerySymbols: boolean;
  widget: MetricFormulaWidgetParams;
}

function Formula({
  availableVariables,
  index,
  widget,
  onChange,
  onToggleVisibility,
  canBeHidden,
  isSelected,
  showQuerySymbols,
  formulaDependencies,
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
          type={MetricQueryType.FORMULA}
        />
      )}
      <FormulaInput
        availableVariables={availableVariables}
        value={widget.formula}
        onChange={formula => handleChange({formula})}
      />
      <MetricFormulaContextMenu
        widgetIndex={index}
        formulaWidget={widget}
        formulaDependencies={formulaDependencies}
      />
    </QueryWrapper>
  );
}

interface QueryToggleProps {
  disabled: boolean;
  isHidden: boolean;
  isSelected: boolean;
  onChange: (isHidden: boolean) => void;
  queryId: number;
  type: MetricQueryType;
}

function QueryToggle({
  isHidden,
  queryId,
  disabled,
  onChange,
  isSelected,
  type,
}: QueryToggleProps) {
  let tooltipTitle = isHidden ? t('Show query') : t('Hide query');
  if (disabled) {
    tooltipTitle = t('At least one query must be visible');
  }

  return (
    <Tooltip title={tooltipTitle} delay={500}>
      {type === MetricQueryType.QUERY ? (
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
      ) : (
        <StyledEquationSymbol
          isHidden={isHidden}
          equationId={queryId}
          isClickable={!disabled}
          aria-disabled={disabled}
          isSelected={isSelected}
          onClick={disabled ? undefined : () => onChange(!isHidden)}
          role="button"
          aria-label={isHidden ? t('Show query') : t('Hide query')}
        />
      )}
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

const StyledEquationSymbol = styled(EquationSymbol)<{isClickable: boolean}>`
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
