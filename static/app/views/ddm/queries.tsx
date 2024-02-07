import {useCallback, useLayoutEffect} from 'react';
import styled from '@emotion/styled';
import * as echarts from 'echarts/core';

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
          {showQuerySymbols && (
            <StyledQuerySymbol
              index={index}
              isSelected={index === selectedWidgetIndex}
              onClick={() => setSelectedWidgetIndex(index)}
              role="button"
              aria-label={t('Select query')}
            />
          )}
          <QueryBuilder
            onChange={data => handleChange(index, data)}
            metricsQuery={{
              mri: widget.mri,
              op: widget.op,
              groupBy: widget.groupBy,
              title: widget.title,
              query: widget.query,
            }}
            displayType={widget.displayType}
            isEdit
            projects={selection.projects}
          />
          <MetricQueryContextMenu
            displayType={widget.displayType}
            widgetIndex={index}
            metricsQuery={{
              mri: widget.mri,
              query: widget.query,
              op: widget.op,
              groupBy: widget.groupBy,
              projects: selection.projects,
              datetime: selection.datetime,
              environments: selection.environments,
              title: widget.title,
            }}
          />
        </Row>
      ))}
    </Wrapper>
  );
}

const StyledQuerySymbol = styled(QuerySymbol)`
  margin-top: 10px;
  cursor: pointer;
`;

const Wrapper = styled('div')<{showQuerySymbols: boolean}>`
  padding-bottom: ${space(2)};
  display: grid;
  grid-template-columns: 1fr max-content;
  gap: ${space(1)};

  ${p =>
    p.showQuerySymbols &&
    `
    grid-template-columns: min-content 1fr max-content;
  `}
`;

const Row = styled('div')`
  display: contents;
`;
