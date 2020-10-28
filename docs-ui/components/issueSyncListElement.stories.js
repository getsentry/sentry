import React from 'react';
import styled from '@emotion/styled';
import {withInfo} from '@storybook/addon-info';

import space from 'app/styles/space';
import IssueSyncListElement from 'app/components/issueSyncListElement';

export default {
  title: 'Features/Issues/IssueSyncListElement',
};

export const WithoutIssueAdded = withInfo('No issue id or url has been passed')(() => (
  <StyledIssueSyncList>
    <IssueSyncListElement integrationType="github" />
    <IssueSyncListElement integrationType="jira" />
    <IssueSyncListElement integrationType="vsts" />
    <IssueSyncListElement integrationType="gitlab" />
  </StyledIssueSyncList>
));

WithoutIssueAdded.story = {
  name: 'without issue added',
};

export const WithIssueAdded = withInfo('Both an Issue ID and URL have been passed')(
  () => (
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
  )
);

WithIssueAdded.story = {
  name: 'with issue added',
};

const StyledIssueSyncList = styled('div')`
  max-width: 300px;
  margin: 0 auto;
  background: #fff;
  padding: ${space(1)};
  box-shadow: ${p => p.theme.dropShadowHeavy};
`;
