import {Fragment} from 'react';
import styled from '@emotion/styled';

import Alert from 'sentry/components/alert';
import Panel from 'sentry/components/panels/panel';
import PanelHeader from 'sentry/components/panels/panelHeader';
import {t, tct, tn} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Organization} from 'sentry/types';
import type {TraceErrorOrIssue} from 'sentry/utils/performance/quickTrace/types';

import {Issue} from './issue';

type Props = {
  event_id: string;
  issues: TraceErrorOrIssue[];
  nodeType: 'span' | 'transaction';
  organization: Organization;
};

function IssueListHeader() {
  return (
    <StyledPanelHeader disablePadding>
      <IssueHeading>{t('Issue')}</IssueHeading>
      <GraphHeading>{t('Graph')}</GraphHeading>
      <Heading>{t('Events')}</Heading>
      <UsersHeading>{t('Users')}</UsersHeading>
      <Heading>{t('Assignee')}</Heading>
    </StyledPanelHeader>
  );
}

function IssueList({issues, organization, nodeType, event_id}: Props) {
  if (!issues.length) {
    return null;
  }

  return (
    <Fragment>
      <StyledAlert type="error" showIcon>
        {tct('This [nodeType] has [count] [issueText] associated with it', {
          nodeType,
          count: issues.length,
          issueText: tn('issue', 'issues', issues.length),
        })}
      </StyledAlert>
      <StyledPanel>
        <IssueListHeader />
        {issues.map((issue, index) => (
          <Issue
            key={index}
            issue={issue}
            organization={organization}
            event_id={event_id}
          />
        ))}
      </StyledPanel>
    </Fragment>
  );
}

const Heading = styled('div')`
  display: flex;
  align-self: center;
  margin: 0 ${space(2)};
  width: 60px;
  color: ${p => p.theme.subText};
`;

const IssueHeading = styled(Heading)`
  flex: 1;
  width: 66.66%;

  @media (min-width: ${p => p.theme.breakpoints.medium}) {
    width: 50%;
  }
`;

const GraphHeading = styled(Heading)`
  width: 160px;
  display: flex;
  justify-content: center;
`;

const UsersHeading = styled(Heading)`
  display: flex;
  justify-content: center;
`;

const StyledPanel = styled(Panel)`
  margin-bottom: 0;
`;

const StyledAlert = styled(Alert)`
  margin-bottom: 0;
`;

const StyledPanelHeader = styled(PanelHeader)`
  padding-top: ${space(1)};
  padding-bottom: ${space(1)};
`;

export default IssueList;
