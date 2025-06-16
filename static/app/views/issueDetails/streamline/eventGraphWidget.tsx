import styled from '@emotion/styled';

import {useFetchGroupAndEvent} from 'sentry/components/featureFlags/hooks/useFetchGroupAndEvent';
import Placeholder from 'sentry/components/placeholder';
import {t} from 'sentry/locale';
import type {PageFilters} from 'sentry/types/core';
import type {ReactEchartsRef} from 'sentry/types/echarts';
import type {Event} from 'sentry/types/event';
import type {Group} from 'sentry/types/group';
import {decodeScalar} from 'sentry/utils/queryString';
import useLocationQuery from 'sentry/utils/url/useLocationQuery';
import {useParams} from 'sentry/utils/useParams';
import {Widget} from 'sentry/views/dashboards/widgets/widget/widget';
import type {LoadableChartWidgetProps} from 'sentry/views/insights/common/components/widgets/types';
import {EventGraph} from 'sentry/views/issueDetails/streamline/eventGraph';
import {useIssueDetailsEventView} from 'sentry/views/issueDetails/streamline/hooks/useIssueDetailsDiscoverQuery';
import {ReleasesDrawerFields} from 'sentry/views/releases/drawer/utils';

export default function EventGraphWidget({
  pageFilters,
  chartRef,
}: LoadableChartWidgetProps) {
  const {groupId} = useParams();
  const {[ReleasesDrawerFields.EVENT_ID]: eventId} = useLocationQuery({
    fields: {
      [ReleasesDrawerFields.EVENT_ID]: decodeScalar,
    },
  });

  const {
    event,
    group: groupData,
    isPending,
    isError,
  } = useFetchGroupAndEvent({
    eventId,
    groupId,
    enabled: Boolean(eventId && groupId),
  });

  if (isPending) {
    return (
      <Container>
        <Placeholder height="100%" />
      </Container>
    );
  }

  if (isError || !event || !groupData) {
    return (
      <Container>
        <Placeholder height="100%" error={t('Error loading chart')} />
      </Container>
    );
  }

  return (
    <EventGraphLoadedWidget
      chartRef={chartRef}
      event={event}
      group={groupData}
      pageFilters={pageFilters}
    />
  );
}

function EventGraphLoadedWidget({
  group,
  event,
  pageFilters,
  chartRef,
}: {
  event: Event;
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
          ref={chartRef}
          event={event}
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
