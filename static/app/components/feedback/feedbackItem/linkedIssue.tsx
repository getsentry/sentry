import styled from '@emotion/styled';

import ErrorBoundary from 'sentry/components/errorBoundary';
import EventOrGroupExtraDetails from 'sentry/components/eventOrGroupExtraDetails';
import EventOrGroupHeader from 'sentry/components/eventOrGroupHeader';
import Section from 'sentry/components/feedback/feedbackItem/feedbackItemSection';
import Placeholder from 'sentry/components/placeholder';
import {IconIssues} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {Group, Organization} from 'sentry/types';
import {useApiQuery} from 'sentry/utils/queryClient';

interface Props {
  crashReportId: string;
  groupID: string;
  organization: Organization;
}

export default function LinkedIssue({groupID, organization, crashReportId}: Props) {
  const issueEndpoint = `/organizations/${organization.slug}/issues/${groupID}/`;
  const {data: groupData, isLoading} = useApiQuery<Group>([issueEndpoint], {
    staleTime: 0,
  });

  return (
    <Section icon={<IconIssues size="xs" />} title={t('Linked Issue')}>
      {isLoading ? (
        <Placeholder height="92px" />
      ) : groupData ? (
        <ErrorBoundary mini>
          <IssueDetailsContainer>
            <EventOrGroupHeader
              eventId={crashReportId}
              organization={organization}
              data={groupData}
              size="normal"
            />
            <EventOrGroupExtraDetails data={groupData} showInboxTime />
          </IssueDetailsContainer>
        </ErrorBoundary>
      ) : null}
    </Section>
  );
}

const IssueDetailsContainer = styled('div')`
  border: 1px solid ${p => p.theme.border};
  border-radius: ${p => p.theme.borderRadius};
  position: relative;
  padding: ${space(1.5)} ${space(1.5)} ${space(1.5)} ${space(2)};
  overflow: auto;
`;
