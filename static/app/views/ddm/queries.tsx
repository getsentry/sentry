import {useCallback, useLayoutEffect} from 'react';
import styled from '@emotion/styled';
import * as Sentry from '@sentry/react';
import * as echarts from 'echarts/core';

import {Button} from 'sentry/components/button';
import {IconAdd} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {trackAnalytics} from 'sentry/utils/analytics';
import {MetricWidgetQueryParams} from 'sentry/utils/metrics';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';
import {DDM_CHART_GROUP} from 'sentry/views/ddm/constants';
import {useDDMContext} from 'sentry/views/ddm/context';
import {MetricQueryContextMenu} from 'sentry/views/ddm/contextMenu';
import {QueryBuilder} from 'sentry/views/ddm/queryBuilder';
import {QuerySymbol} from 'sentry/views/ddm/querySymbol';

export function Queries() {
  const organization = useOrganization();
  const {widgets, updateWidget, addWidget, setSelectedWidgetIndex} = useDDMContext();
  const {selection} = usePageFilters();

  const hasEmptyWidget = widgets.length === 0 || widgets.some(widget => !widget.mri);

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
    <Wrapper>
      {widgets.map((widget, index) => (
        <Row key={index} onFocusCapture={() => setSelectedWidgetIndex(index)}>
          <StyledQuerySymbol index={index} />
          <QueryBuilder
            onChange={data => handleChange(index, data)}
            metricsQuery={{
              mri: widget.mri,
              op: widget.op,
              groupBy: widget.groupBy,
              title: widget.title,
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
      {/* placeholder for first grid column */}
      <div />
      <div>
        <Button
          disabled={hasEmptyWidget}
          icon={<IconAdd size="xs" isCircled />}
          onClick={() => {
            trackAnalytics('ddm.widget.add', {
              organization,
            });
            Sentry.metrics.increment('ddm.widget.add');
            addWidget();
          }}
        >
          {t('Add Query')}
        </Button>
      </div>
    </Wrapper>
  );
}

const StyledQuerySymbol = styled(QuerySymbol)`
  margin-top: 10px;
`;

const Wrapper = styled('div')`
  padding-bottom: ${space(2)};
  display: grid;
  grid-template-columns: min-content 1fr max-content;
  gap: ${space(1)};
`;

const Row = styled('div')`
  display: contents;
`;
