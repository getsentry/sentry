import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';

import EventTagsTree from 'sentry/components/events/eventTags/eventTagsTree';
import {associateTagsWithMeta} from 'sentry/components/events/eventTags/util';
import LoadingError from 'sentry/components/loadingError';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import Panel from 'sentry/components/panels/panel';
import {space} from 'sentry/styles/space';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import {AttributesTree} from 'sentry/views/explore/components/traceItemAttributes/attributesTree';
import type {TraceRootEventQueryResults} from 'sentry/views/performance/newTraceDetails/traceApi/useTraceRootEvent';
import {isTraceItemDetailsResponse} from 'sentry/views/performance/newTraceDetails/traceApi/utils';
import {sortAttributes} from 'sentry/views/performance/newTraceDetails/traceDrawer/details/utils';
import {useHasTraceTabsUI} from 'sentry/views/performance/newTraceDetails/useHasTraceTabsUI';

type Props = {
  rootEventResults: TraceRootEventQueryResults;
};

export function TraceContextTags({rootEventResults}: Props) {
  const theme = useTheme();
  const location = useLocation();
  const organization = useOrganization();
  const hasTraceTabsUi = useHasTraceTabsUI();

  if (rootEventResults.isLoading) {
    return <LoadingIndicator />;
  }

  if (rootEventResults.error) {
    return <LoadingError />;
  }

  const eventDetails = rootEventResults.data!;
  const rendered = isTraceItemDetailsResponse(eventDetails) ? (
    <AttributesTree
      attributes={sortAttributes(eventDetails.attributes)}
      rendererExtra={{
        theme,
        location,
        organization,
      }}
    />
  ) : (
    <EventTagsTree
      event={eventDetails}
      projectSlug={eventDetails.projectSlug ?? ''}
      tags={associateTagsWithMeta({
        tags: eventDetails.tags,
        meta: eventDetails._meta?.tags,
      })}
    />
  );

  if (hasTraceTabsUi) {
    return <StyledPanel>{rendered}</StyledPanel>;
  }

  return rendered;
}

const StyledPanel = styled(Panel)`
  padding: ${space(2)} ${space(2)} ${space(2)} 24px;
  margin: 0;
`;
