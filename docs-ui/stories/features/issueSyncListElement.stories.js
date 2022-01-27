import styled from '@emotion/styled';

import IssueSyncListElement from 'sentry/components/issueSyncListElement';
import space from 'sentry/styles/space';

export default {
  title: 'Features/Issues/Issue Sync List',
  component: IssueSyncListElement,
};

export const WithoutIssueAdded = () => (
  <StyledIssueSyncList>
    <IssueSyncListElement integrationType="github" />
    <IssueSyncListElement integrationType="jira" />
    <IssueSyncListElement integrationType="vsts" />
    <IssueSyncListElement integrationType="gitlab" />
  </StyledIssueSyncList>
);

WithoutIssueAdded.storyName = 'Without Issue Added';
WithoutIssueAdded.parameters = {
  docs: {
    description: {
      story: 'No issue id or url has been passed',
    },
  },
};

export const WithIssueAdded = () => (
  <StyledIssueSyncList>
    <IssueSyncListElement
      integrationType="github"
      externalIssueLink="github.com/issues/gh-101"
      externalIssueId="101"
      onOpen={() => {}}
      onClose={() => {}}
    />
    <IssueSyncListElement
      integrationType="jira"
      externalIssueLink="getsentry.atlassian.net/browse/APP-367"
      externalIssueId="367"
      onOpen={() => {}}
      onClose={() => {}}
    />
    <IssueSyncListElement
      integrationType="vsts"
      externalIssueLink="visualstudio.microsoft.com/issues/vsts-35"
      externalIssueId="35"
      onOpen={() => {}}
      onClose={() => {}}
    />
    <IssueSyncListElement
      integrationType="gitlab"
      externalIssueLink="gitlab.com/issues/35"
      externalIssueId="35"
      onOpen={() => {}}
      onClose={() => {}}
    />
    <IssueSyncListElement
      integrationType="bitbucket"
      externalIssueLink="bitbucket.org/issues/35"
      externalIssueId="35"
      onOpen={() => {}}
      onClose={() => {}}
    />
    <IssueSyncListElement
      integrationType="jira_server"
      externalIssueLink="jira.atlassian.net/browse/APP-367"
      externalIssueId="367"
      onOpen={() => {}}
      onClose={() => {}}
    />
  </StyledIssueSyncList>
);

WithIssueAdded.storyName = 'With Issue Added';
WithIssueAdded.parameters = {
  docs: {
    description: {
      story: 'Both an Issue ID and URL have been passed',
    },
  },
};

const StyledIssueSyncList = styled('div')`
  max-width: 300px;
  margin: 0 auto;
  background: #fff;
  padding: ${space(1)};
  box-shadow: ${p => p.theme.dropShadowHeavy};
`;
