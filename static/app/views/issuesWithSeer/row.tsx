import styled from '@emotion/styled';

import EventOrGroupExtraDetails from 'sentry/components/eventOrGroupExtraDetails';
import EventOrGroupHeader from 'sentry/components/eventOrGroupHeader';
import {
  CommentCountCell,
  SeerWorkflowCell,
} from 'sentry/views/issuesWithSeer/statusCells';
import type {IssueWithSeer} from 'sentry/views/issuesWithSeer/types';

interface IssueWithSeerRowProps {
  issueWithSeer: IssueWithSeer;
}

function getSeerStatus(
  hasArtifact: boolean | undefined,
  seerState: IssueWithSeer['automation']['seerState']
): 'yes' | 'no' | 'in_progress' | 'error' {
  if (hasArtifact) {
    return 'yes';
  }

  if (!seerState) {
    return 'no';
  }

  if (seerState.status === 'PROCESSING') {
    return 'in_progress';
  }

  if (seerState.status === 'ERROR') {
    return 'error';
  }

  return 'no';
}

export function IssueWithSeerRow({issueWithSeer}: IssueWithSeerRowProps) {
  const {
    automation: {seerState, hasRCA, hasSolution, hasCodeChanges, hasPR, prLinks},
    issue,
  } = issueWithSeer;

  const rcaStatus = getSeerStatus(hasRCA, seerState);
  const solutionStatus = getSeerStatus(hasSolution, seerState);
  const codeChangesStatus = getSeerStatus(hasCodeChanges, seerState);
  const prStatus = getSeerStatus(hasPR, seerState);

  return (
    <RowContainer>
      <IssueInfoCell>
        <EventOrGroupHeader data={issue} />
        <EventOrGroupExtraDetails data={issue} showLifetime={false} />
      </IssueInfoCell>

      <WorkflowCell>
        <SeerWorkflowCell
          rcaStatus={rcaStatus}
          solutionStatus={solutionStatus}
          codeChangesStatus={codeChangesStatus}
          prStatus={prStatus}
          seerState={seerState}
          prLinks={prLinks}
          groupId={issue.id}
        />
      </WorkflowCell>

      <StatusCell>
        <CommentCountCell botComments={0} humanComments={0} />
      </StatusCell>
    </RowContainer>
  );
}

const RowContainer = styled('div')`
  display: grid;
  grid-template-columns: 3fr 3fr 1fr;
  gap: ${p => p.theme.space.xl};
  padding: ${p => p.theme.space.xl};
  border-bottom: 1px solid ${p => p.theme.tokens.border.primary};
  align-items: center;

  &:hover {
    background-color: ${p => p.theme.tokens.background.secondary};
  }
`;

const IssueInfoCell = styled('div')`
  min-width: 0;
  overflow: hidden;
`;

const WorkflowCell = styled('div')`
  display: flex;
  align-items: center;
  justify-content: center;
`;

const StatusCell = styled('div')`
  display: flex;
  align-items: center;
  justify-content: center;
`;
