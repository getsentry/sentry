import styled from '@emotion/styled';
import type {EChartsInstance} from 'echarts-for-react';

import Placeholder from 'sentry/components/placeholder';
import {t} from 'sentry/locale';
import type {PageFilters} from 'sentry/types/core';
import type {Event} from 'sentry/types/event';
import type {Group} from 'sentry/types/group';
import {useApiQuery} from 'sentry/utils/queryClient';
import {decodeScalar} from 'sentry/utils/queryString';
import useLocationQuery from 'sentry/utils/url/useLocationQuery';
import useOrganization from 'sentry/utils/useOrganization';
import {useParams} from 'sentry/utils/useParams';
import {Widget} from 'sentry/views/dashboards/widgets/widget/widget';
import type {LoadableChartWidgetProps} from 'sentry/views/insights/common/components/widgets/types';
import {EventGraph} from 'sentry/views/issueDetails/streamline/eventGraph';
import {useIssueDetailsEventView} from 'sentry/views/issueDetails/streamline/hooks/useIssueDetailsDiscoverQuery';
import {useGroup} from 'sentry/views/issueDetails/useGroup';
import {ReleasesDrawerFields} from 'sentry/views/releases/drawer/utils';

export default function EventGraphWidget({
  pageFilters,
  chartRef,
}: LoadableChartWidgetProps) {
  const {groupId} = useParams();
  const organization = useOrganization();
  const {[ReleasesDrawerFields.EVENT_ID]: eventId} = useLocationQuery({
    fields: {
      [ReleasesDrawerFields.EVENT_ID]: decodeScalar,
    },
  });

  const {data: groupData, isPending, isError} = useGroup({groupId: groupId!});
  const projectSlug = groupData?.project.slug;
  const {
    data: event,
    isPending: isEventPending,
    isError: isEventError,
  } = useApiQuery<Event>(
    [`/organizations/${organization.slug}/events/${projectSlug}:${eventId}/`],
    {staleTime: Infinity, enabled: Boolean(eventId && projectSlug && organization.slug)}
  );

  if (isPending || isEventPending) {
    return (
      <Container>
        <Placeholder height="100%" />
      </Container>
    );
  }

  if (isError || isEventError) {
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
  chartRef?: React.Ref<EChartsInstance>;
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
<<<<<<< HEAD
          event={undefined}
          ref={chartRef}
=======
          ref={chartRef}
          event={event}
>>>>>>> f8648b2c5ec (feat(flags): Add feature flags to bubbles + drawer)
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
