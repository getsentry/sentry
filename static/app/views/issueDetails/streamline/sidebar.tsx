import styled from '@emotion/styled';

import Feature from 'sentry/components/acl/feature';
import ErrorBoundary from 'sentry/components/errorBoundary';
import {StreamlinedExternalIssueList} from 'sentry/components/group/externalIssuesList/streamlinedExternalIssueList';
import {GroupSummary} from 'sentry/components/group/groupSummary';
import {space} from 'sentry/styles/space';
import StreamlinedActivitySection from 'sentry/views/issueDetails/streamline/activitySection';
import {useHasStreamlinedUI} from 'sentry/views/issueDetails/utils';

export default function StreamlinedSidebar({group, event, project}) {
  const hasStreamlinedUI = useHasStreamlinedUI();

  return (
    <div>
      <Feature features={['organizations:ai-summary']}>
        <GroupSummary groupId={group.id} groupCategory={group.issueCategory} />
      </Feature>
      {hasStreamlinedUI && event && (
        <ErrorBoundary mini>
          <StreamlinedExternalIssueList group={group} event={event} project={project} />
        </ErrorBoundary>
      )}
      <StyledBreak />
      <StreamlinedActivitySection group={group} />
    </div>
  );
}

const StyledBreak = styled('hr')`
  margin-top: ${space(2)};
  margin-bottom: ${space(2)};
  border-color: ${p => p.theme.border};
`;
