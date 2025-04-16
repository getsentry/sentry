import styled from '@emotion/styled';

import Placeholder from 'sentry/components/placeholder';
import {t} from 'sentry/locale';
import {useParams} from 'sentry/utils/useParams';
import type {LoadableChartWidgetProps} from 'sentry/views/insights/common/components/widgets/types';
import {EventGraph} from 'sentry/views/issueDetails/streamline/eventGraph';
import {useIssueDetailsEventView} from 'sentry/views/issueDetails/streamline/hooks/useIssueDetailsDiscoverQuery';
import {useGroup} from 'sentry/views/issueDetails/useGroup';

export default function EventGraphWidget({pageFilters}: LoadableChartWidgetProps) {
  const {groupId} = useParams();

  const {
    data: groupData,
    isPending: loadingGroup,
    isError: isGroupError,
  } = useGroup({groupId: groupId!});

  const eventView = useIssueDetailsEventView({
    group: groupData!,
    isSmallContainer: true,
    pageFilters,
  });

  if (loadingGroup) {
    return (
      <Container>
        <Placeholder height="100%" />
      </Container>
    );
  }

  if (isGroupError) {
    return (
      <Container>
        <Placeholder height="100%" error={t('Error loading chart')} />
      </Container>
    );
  }

  return (
    <EventGraph
      event={undefined}
      eventView={eventView}
      group={groupData}
      showSummary={false}
      showReleasesAs="line"
      disableZoomNavigation
    />
  );
}

const Container = styled('div')`
  height: 100%;
`;

export const EVENT_GRAPH_WIDGET_ID = 'event-graph-widget';
