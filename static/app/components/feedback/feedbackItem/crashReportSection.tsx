import styled from '@emotion/styled';

import ErrorBoundary from 'sentry/components/errorBoundary';
import EventOrGroupExtraDetails from 'sentry/components/eventOrGroupExtraDetails';
import EventOrGroupHeader from 'sentry/components/eventOrGroupHeader';
import Section from 'sentry/components/feedback/feedbackItem/feedbackItemSection';
import {IconIssues} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {Event, Group, Organization} from 'sentry/types';
import {useApiQuery} from 'sentry/utils/queryClient';

interface Props {
  crashReportId: string;
  organization: Organization;
  projSlug: string;
}

export default function CrashReportSection({
  crashReportId,
  organization,
  projSlug,
}: Props) {
  const eventEndpoint = `/projects/${organization.slug}/${projSlug}/events/${crashReportId}/`;
  const {data: crashReportData} = useApiQuery<Event>([eventEndpoint], {staleTime: 0});
  // need to fetch the issue data since the event data is not complete enough for the component
  const groupId = crashReportData?.groupID;
  const issueEndpoint = `/organizations/${organization.slug}/issues/${groupId}/`;
  const {data: groupData} = useApiQuery<Group>([issueEndpoint], {staleTime: 0});

  return groupData ? (
    <Section icon={<IconIssues size="xs" />} title={t('Linked Issue')}>
      <ErrorBoundary mini>
        <IssueDetailsContainer>
          <EventOrGroupHeader
            organization={organization}
            data={groupData}
            size="normal"
          />
          <EventOrGroupExtraDetails data={groupData} showInboxTime />
        </IssueDetailsContainer>
      </ErrorBoundary>
    </Section>
  ) : null;
}

const IssueDetailsContainer = styled('div')`
  border: 1px solid ${p => p.theme.border};
  border-radius: ${p => p.theme.borderRadius};
  position: relative;
  padding: ${space(1.5)} ${space(1.5)} ${space(1.5)} ${space(2)};
`;
