import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';

import EventTagsTree from 'sentry/components/events/eventTags/eventTagsTree';
import LoadingError from 'sentry/components/loadingError';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {space} from 'sentry/styles/space';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import {AttributesTree} from 'sentry/views/explore/components/traceItemAttributes/attributesTree';
import type {TraceRootEventQueryResults} from 'sentry/views/performance/newTraceDetails/traceApi/useTraceRootEvent';
import {isTraceItemDetailsResponse} from 'sentry/views/performance/newTraceDetails/traceApi/utils';
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
  return (
    <TagsContainer hasTraceTabsUi={hasTraceTabsUi}>
      {isTraceItemDetailsResponse(eventDetails) ? (
        <AttributesTree
          attributes={eventDetails.attributes}
          rendererExtra={{
            theme,
            location,
            organization,
          }}
        />
      ) : (
        <EventTagsTree
          event={eventDetails}
          meta={eventDetails._meta}
          projectSlug={eventDetails.projectSlug ?? ''}
          tags={eventDetails.tags}
        />
      )}
    </TagsContainer>
  );
}

const TagsContainer = styled('div')<{hasTraceTabsUi: boolean}>`
  ${p =>
    p.hasTraceTabsUi &&
    `
      padding: 0 ${space(1)};
    `}
`;
