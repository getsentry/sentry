import {Fragment, useCallback, useLayoutEffect} from 'react';
import styled from '@emotion/styled';
import * as echarts from 'echarts/core';

import {Button} from 'sentry/components/button';
import Input from 'sentry/components/input';
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
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';
import {DDM_CHART_GROUP} from 'sentry/views/ddm/constants';
import {useDDMContext} from 'sentry/views/ddm/context';
import {MetricFormulaContextMenu} from 'sentry/views/ddm/metricFormulaContextMenu';
import {MetricQueryContextMenu} from 'sentry/views/ddm/metricQueryContextMenu';
import {QueryBuilder} from 'sentry/views/ddm/queryBuilder';
import {QuerySymbol} from 'sentry/views/ddm/querySymbol';

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
  const organization = useOrganization();

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

  return (
    <Fragment>
      <Wrapper showQuerySymbols={showQuerySymbols}>
        {widgets.map((widget, index) => (
          <Row key={widget.id} onFocusCapture={() => setSelectedWidgetIndex(index)}>
            {widget.type === MetricQueryType.QUERY ? (
              <Query
                widget={widget}
                onChange={data => handleChange(index, data)}
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
                onChange={data => handleChange(index, data)}
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
          Add query
        </Button>
        {organization.features.includes('ddm-formulas') && (
          <Button
            size="sm"
            icon={<IconAdd isCircled />}
            onClick={() => addWidget(MetricQueryType.FORMULA)}
          >
            Add formula
          </Button>
        )}
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
  onChange: (data: Partial<MetricWidgetQueryParams>) => void;
  projects: number[];
  widget: MetricQueryWidgetParams;
  contextMenu?: React.ReactNode;
  symbol?: React.ReactNode;
}

export function Query({widget, projects, onChange, contextMenu, symbol}: QueryProps) {
  return (
    <QueryWrapper hasSymbol={!!symbol}>
      {symbol}
      <QueryBuilder
        onChange={onChange}
        metricsQuery={{
          mri: widget.mri,
          op: widget.op,
          groupBy: widget.groupBy,
          query: widget.query,
        }}
        displayType={widget.displayType}
        isEdit
        projects={projects}
      />
      {contextMenu}
    </QueryWrapper>
  );
}

interface FormulaProps {
  onChange: (data: Partial<MetricWidgetQueryParams>) => void;
  widget: MetricFormulaWidgetParams;
  contextMenu?: React.ReactNode;
  symbol?: React.ReactNode;
}

export function Formula({widget, onChange, contextMenu, symbol}: FormulaProps) {
  return (
    <QueryWrapper hasSymbol={!!symbol}>
      {symbol}
      <Input value={widget.formula} onChange={e => onChange({formula: e.target.value})} />
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
