import styled from '@emotion/styled';

import {Alert} from 'sentry/components/alert';
import EventOrGroupExtraDetails from 'sentry/components/eventOrGroupExtraDetails';
import EventOrGroupHeader from 'sentry/components/eventOrGroupHeader';
import useFetchCrashReport from 'sentry/components/feedback/feedbackItem/useFetchCrashReport';
import Placeholder from 'sentry/components/placeholder';
import {tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Organization} from 'sentry/types/organization';

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

  if (isFetching) {
    return <Placeholder height="92px" />;
  }

  if (!groupData) {
    return (
      <AlertNoMargin type="error" showIcon>
        {tct('Unable to find error [id]', {id: crashReportId})}
      </AlertNoMargin>
    );
  }

  return (
    <IssueDetailsContainer>
      <EventOrGroupHeader
        eventId={crashReportId}
        organization={organization}
        data={groupData}
      />
      <EventOrGroupExtraDetails data={groupData} />
    </IssueDetailsContainer>
  );
}

const AlertNoMargin = styled(Alert)`
  margin: 0;
`;

const IssueDetailsContainer = styled('div')`
  border: 1px solid ${p => p.theme.border};
  border-radius: ${p => p.theme.borderRadius};
  position: relative;
  padding: ${space(1.5)} ${space(1.5)} ${space(1.5)} ${space(2)};
  overflow: auto;
`;
