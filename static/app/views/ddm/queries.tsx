import {useCallback, useLayoutEffect} from 'react';
import styled from '@emotion/styled';
import * as echarts from 'echarts/core';

import Feature from 'sentry/components/acl/feature';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {MetricWidgetQueryParams} from 'sentry/utils/metrics/types';
import usePageFilters from 'sentry/utils/usePageFilters';
import {DDM_CHART_GROUP} from 'sentry/views/ddm/constants';
import {useDDMContext} from 'sentry/views/ddm/context';
import {MetricQueryContextMenu} from 'sentry/views/ddm/contextMenu';
import {QueryBuilder} from 'sentry/views/ddm/queryBuilder';
import {QuerySymbol} from 'sentry/views/ddm/querySymbol';

export function Queries() {
  const {
    widgets,
    updateWidget,
    setSelectedWidgetIndex,
    showQuerySymbols,
    selectedWidgetIndex,
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

  return (
    <Wrapper showQuerySymbols={showQuerySymbols}>
      {widgets.map((widget, index) => (
        <Row key={index} onFocusCapture={() => setSelectedWidgetIndex(index)}>
          <Query
            widget={widget}
            onChange={data => handleChange(index, data)}
            projects={selection.projects}
            symbol={
              showQuerySymbols && (
                <StyledQuerySymbol
                  index={index}
                  isSelected={index === selectedWidgetIndex}
                  onClick={() => setSelectedWidgetIndex(index)}
                  role="button"
                  aria-label={t('Select query')}
                />
              )
            }
            contextMenu={
              <Feature
                hookName="feature-disabled:dashboards-edit"
                features="organizations:dashboards-edit"
              >
                {({hasFeature}) => (
                  <MetricQueryContextMenu
                    displayType={widget.displayType}
                    widgetIndex={index}
                    hasDashboardFeature={hasFeature}
                    metricsQuery={{
                      mri: widget.mri,
                      query: widget.query,
                      op: widget.op,
                      groupBy: widget.groupBy,
                      projects: selection.projects,
                      datetime: selection.datetime,
                      environments: selection.environments,
                    }}
                  />
                )}
              </Feature>
            }
          />
        </Row>
      ))}
    </Wrapper>
  );
}

interface Props {
  onChange: (data: Partial<MetricWidgetQueryParams>) => void;
  projects: number[];
  widget: MetricWidgetQueryParams;
  contextMenu?: React.ReactNode;
  symbol?: React.ReactNode;
}

export function Query({widget, projects, onChange, contextMenu, symbol}: Props) {
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

const QueryWrapper = styled('div')<{hasSymbol: boolean}>`
  display: grid;
  gap: ${space(1)};
  padding-bottom: ${space(1)};
  grid-template-columns: 1fr max-content;
  ${p => p.hasSymbol && `grid-template-columns: min-content 1fr max-content;`}
`;

const StyledQuerySymbol = styled(QuerySymbol)`
  margin-top: 10px;
  cursor: pointer;
`;

const Wrapper = styled('div')<{showQuerySymbols: boolean}>`
  padding-bottom: ${space(2)};
`;

const Row = styled('div')`
  display: contents;
`;
