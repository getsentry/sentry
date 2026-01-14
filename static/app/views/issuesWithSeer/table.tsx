import styled from '@emotion/styled';

import EmptyStateWarning from 'sentry/components/emptyStateWarning';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import Panel from 'sentry/components/panels/panel';
import PanelBody from 'sentry/components/panels/panelBody';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {IssueWithSeerRow} from 'sentry/views/issuesWithSeer/row';
import type {IssueWithSeer} from 'sentry/views/issuesWithSeer/types';

interface IssuesWithSeerTableProps {
  issues: IssueWithSeer[];
  loading: boolean;
}

export function IssuesWithSeerTable({issues, loading}: IssuesWithSeerTableProps) {
  if (loading) {
    return <LoadingIndicator />;
  }

  if (issues.length === 0) {
    return (
      <Panel>
        <PanelBody>
          <EmptyStateWarning>
            <p>{t('No issues with Seer analysis found.')}</p>
          </EmptyStateWarning>
        </PanelBody>
      </Panel>
    );
  }

  return (
    <Panel>
      <TableHeader>
        <IssueHeaderCell>{t('Issue')}</IssueHeaderCell>
        <WorkflowHeaderCell>
          <WorkflowStepsHeader>
            <StepHeaderCell>{t('Root Cause')}</StepHeaderCell>
            <ConnectorHeaderCell />
            <StepHeaderCell>{t('Solution')}</StepHeaderCell>
            <ConnectorHeaderCell />
            <StepHeaderCell>{t('Code Changes')}</StepHeaderCell>
            <ConnectorHeaderCell />
            <StepHeaderCell>{t('PR')}</StepHeaderCell>
          </WorkflowStepsHeader>
        </WorkflowHeaderCell>
        <CommentsHeaderCell>{t('Comments')}</CommentsHeaderCell>
      </TableHeader>
      <PanelBody>
        {issues.map(issueWithSeer => (
          <IssueWithSeerRow key={issueWithSeer.issue.id} issueWithSeer={issueWithSeer} />
        ))}
      </PanelBody>
    </Panel>
  );
}

const TableHeader = styled('div')`
  display: grid;
  grid-template-columns: 3fr 3fr 1fr;
  gap: ${space(2)};
  padding: ${space(2)};
  background-color: ${p => p.theme.backgroundSecondary};
  border-bottom: 1px solid ${p => p.theme.border};
  border-top-left-radius: 4px;
  border-top-right-radius: 4px;
`;

const IssueHeaderCell = styled('div')`
  display: flex;
  align-items: center;
  justify-content: flex-start;
  font-weight: 600;
  font-size: 10px;
  text-transform: uppercase;
  color: ${p => p.theme.tokens.content.secondary};
`;

const WorkflowHeaderCell = styled('div')`
  display: flex;
  align-items: center;
  justify-content: center;
`;

const WorkflowStepsHeader = styled('div')`
  display: flex;
  align-items: center;
  gap: ${space(1)};
  width: 100%;
`;

const StepHeaderCell = styled('div')`
  font-weight: 600;
  font-size: 10px;
  text-transform: uppercase;
  color: ${p => p.theme.tokens.content.secondary};
  text-align: center;
  flex: 1;
`;

const ConnectorHeaderCell = styled('div')`
  width: 28px;
  flex-shrink: 0;
`;

const CommentsHeaderCell = styled('div')`
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 600;
  font-size: 10px;
  text-transform: uppercase;
  color: ${p => p.theme.tokens.content.secondary};
`;
