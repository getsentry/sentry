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
import {
  findSpanAttributeValue,
  getTraceAttributesTreeActions,
  sortAttributes,
} from 'sentry/views/performance/newTraceDetails/traceDrawer/details/utils';

type Props = {
  rootEventResults: TraceRootEventQueryResults;
};

export function TraceContextTags({rootEventResults}: Props) {
  const theme = useTheme();
  const location = useLocation();
  const organization = useOrganization();

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
      getCustomActions={getTraceAttributesTreeActions({
        location,
        organization,
        projectIds: findSpanAttributeValue(eventDetails.attributes, 'project_id'),
      })}
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

  return <StyledPanel>{rendered}</StyledPanel>;
}

const StyledPanel = styled(Panel)`
  padding: ${space(2)} ${space(2)} ${space(2)} 24px;
  margin: 0;
`;
