import styled from '@emotion/styled';

import Placeholder from 'sentry/components/placeholder';
import {t} from 'sentry/locale';
import type {PageFilters} from 'sentry/types/core';
import type {ReactEchartsRef} from 'sentry/types/echarts';
import type {Group} from 'sentry/types/group';
import {useParams} from 'sentry/utils/useParams';
import {Widget} from 'sentry/views/dashboards/widgets/widget/widget';
import type {LoadableChartWidgetProps} from 'sentry/views/insights/common/components/widgets/types';
import {EventGraph} from 'sentry/views/issueDetails/streamline/eventGraph';
import {useIssueDetailsEventView} from 'sentry/views/issueDetails/streamline/hooks/useIssueDetailsDiscoverQuery';
import {useGroup} from 'sentry/views/issueDetails/useGroup';

export default function EventGraphWidget({
  pageFilters,
  chartRef,
}: LoadableChartWidgetProps) {
  const {groupId} = useParams();

  const {data: groupData, isPending, isError} = useGroup({groupId: groupId!});

  if (isPending) {
    return (
      <Container>
        <Placeholder height="100%" />
      </Container>
    );
  }

  if (isError) {
    return (
      <Container>
        <Placeholder height="100%" error={t('Error loading chart')} />
      </Container>
    );
  }

  return (
    <EventGraphLoadedWidget
      chartRef={chartRef}
      group={groupData}
      pageFilters={pageFilters}
    />
  );
}

function EventGraphLoadedWidget({
  group,
  pageFilters,
  chartRef,
}: {
  group: Group;
  pageFilters: PageFilters | undefined;
  chartRef?: React.Ref<ReactEchartsRef>;
}) {
  const eventView = useIssueDetailsEventView({
    group,
    isSmallContainer: true,
    pageFilters,
  });

  return (
    <Widget
      Title={<Widget.WidgetTitle title={t('Events')} />}
      Visualization={
        <EventGraph
          event={undefined}
          ref={chartRef}
          eventView={eventView}
          group={group}
          showSummary={false}
          showReleasesAs="line"
          disableZoomNavigation
        />
      }
    />
  );
}

const Container = styled('div')`
  height: 100%;
`;

export const EVENT_GRAPH_WIDGET_ID = 'event-graph-widget';
