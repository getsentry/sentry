import {useEffect} from 'react';
import styled from '@emotion/styled';

import {Alert} from 'sentry/components/core/alert';
import EventOrGroupExtraDetails from 'sentry/components/eventOrGroupExtraDetails';
import EventOrGroupHeader from 'sentry/components/eventOrGroupHeader';
import useFetchCrashReport from 'sentry/components/feedback/feedbackItem/useFetchCrashReport';
import Placeholder from 'sentry/components/placeholder';
import {tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Organization} from 'sentry/types/organization';
import {trackAnalytics} from 'sentry/utils/analytics';

interface Props {
  crashReportId: string;
  organization: Organization;
  projectSlug: string;
}

export default function CrashReportSection({
  crashReportId,
  organization,
  projectSlug,
}: Props) {
  const {isFetching, groupData} = useFetchCrashReport({
    crashReportId,
    organization,
    projectSlug,
  });

  useEffect(() => {
    if (!groupData) {
      trackAnalytics('feedback.no_associated_event_found', {
        orgSlug: organization.slug,
        organization,
      });
    }
  }, [organization, groupData]);

  if (isFetching) {
    return <Placeholder height="92px" />;
  }

  if (!groupData) {
    return (
      <Alert type="warning">
        {tct(
          'Event [id] was linked but not found in this project. The event might have been dropped or the ID may be incorrect.',
          {id: crashReportId}
        )}
      </Alert>
    );
  }

  return (
    <IssueDetailsContainer>
      <EventOrGroupHeader eventId={crashReportId} data={groupData} />
      <EventOrGroupExtraDetails data={groupData} />
    </IssueDetailsContainer>
  );
}

const IssueDetailsContainer = styled('div')`
  border: 1px solid ${p => p.theme.border};
  border-radius: ${p => p.theme.radius.md};
  position: relative;
  padding: ${space(1.5)} ${space(1.5)} ${space(1.5)} ${space(2)};
  overflow: auto;
`;
