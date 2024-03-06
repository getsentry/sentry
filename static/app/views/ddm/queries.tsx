import {Fragment, useCallback, useLayoutEffect, useMemo} from 'react';
import styled from '@emotion/styled';
import * as echarts from 'echarts/core';

import {Button} from 'sentry/components/button';
import SwitchButton from 'sentry/components/switchButton';
import {IconAdd} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {
  type MetricFormulaWidgetParams,
  MetricQueryType,
  type MetricQueryWidgetParams,
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

  return (
    <Fragment>
      <Wrapper showQuerySymbols={showQuerySymbols}>
        {widgets.map((widget, index) => (
          <Row key={widget.id} onFocusCapture={() => setSelectedWidgetIndex(index)}>
            {widget.type === MetricQueryType.QUERY ? (
              <Query
                widget={widget}
                onChange={handleChange}
                index={index}
                projects={selection.projects}
                symbol={
                  showQuerySymbols && (
                    <StyledQuerySymbol
                      queryId={widget.id}
                      isClickable={isMultiChartMode}
                      isSelected={index === selectedWidgetIndex}
                      onClick={() => setSelectedWidgetIndex(index)}
                      role={isMultiChartMode ? 'button' : undefined}
                      aria-label={t('Select query')}
                    />
                  )
                }
                contextMenu={
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
                }
              />
            ) : (
              <Formula
                availableVariables={querySymbols}
                formulaVariables={formulaSymbols}
                onChange={handleChange}
                index={index}
                widget={widget}
                symbol={
                  showQuerySymbols && (
                    <StyledQuerySymbol
                      queryId={widget.id}
                      isClickable={isMultiChartMode}
                      isSelected={index === selectedWidgetIndex}
                      onClick={() => setSelectedWidgetIndex(index)}
                      role={isMultiChartMode ? 'button' : undefined}
                      aria-label={t('Select query')}
                    />
                  )
                }
                contextMenu={<MetricFormulaContextMenu widgetIndex={index} />}
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
  index: number;
  onChange: (index: number, data: Partial<MetricWidgetQueryParams>) => void;
  projects: number[];
  widget: MetricQueryWidgetParams;
  contextMenu?: React.ReactNode;
  symbol?: React.ReactNode;
}

export function Query({
  widget,
  projects,
  onChange,
  contextMenu,
  symbol,
  index,
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

  const handleChange = useCallback(
    (data: Partial<MetricWidgetQueryParams>) => {
      onChange(index, data);
    },
    [index, onChange]
  );

  return (
    <QueryWrapper hasSymbol={!!symbol}>
      {symbol}
      <QueryBuilder
        onChange={handleChange}
        metricsQuery={metricsQuery}
        displayType={widget.displayType}
        isEdit
        projects={projects}
      />
      {contextMenu}
    </QueryWrapper>
  );
}

interface FormulaProps {
  availableVariables: Set<string>;
  formulaVariables: Set<string>;
  index: number;
  onChange: (index: number, data: Partial<MetricWidgetQueryParams>) => void;
  widget: MetricFormulaWidgetParams;
  contextMenu?: React.ReactNode;
  symbol?: React.ReactNode;
}

export function Formula({
  availableVariables,
  formulaVariables,
  index,
  widget,
  onChange,
  contextMenu,
  symbol,
}: FormulaProps) {
  const handleChange = useCallback(
    (formula: string) => {
      onChange(index, {formula});
    },
    [index, onChange]
  );
  return (
    <QueryWrapper hasSymbol={!!symbol}>
      {symbol}
      <FormulaInput
        availableVariables={availableVariables}
        formulaVariables={formulaVariables}
        value={widget.formula}
        onChange={handleChange}
      />
      {contextMenu}
    </QueryWrapper>
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
