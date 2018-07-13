import React from 'react';
import styled from 'react-emotion';
import {storiesOf} from '@storybook/react';
import {withInfo} from '@storybook/addon-info';

import space from 'app/styles/space';
import IssueSyncListElement from 'app/components/issueSyncListElement';

storiesOf('IssueSyncListElement', module)
  .add(
    'without issue added',
    withInfo('No issue id or url has been passed')(() => (
      <StyledIssueSyncList>
        <IssueSyncListElement integrationType="github" />
        <IssueSyncListElement integrationType="jira" />
        <IssueSyncListElement integrationType="vsts" />
      </StyledIssueSyncList>
    ))
  )
  .add(
    'with issue added',
    withInfo('Both an Issue ID and URL have been passed')(() => (
      <StyledIssueSyncList>
        <IssueSyncListElement
          integrationType="github"
          externalIssueLink="github.com/issues/gh-101"
          externalIssueId="GH-101"
        />
        <IssueSyncListElement
          integrationType="jira"
          externalIssueLink="getsentry.atlassian.net/browse/APP-367"
          externalIssueId="APP-367"
        />
        <IssueSyncListElement
          integrationType="vsts"
          externalIssueLink="visualstudio.microsoft.com/issues/vsts-35"
          externalIssueId="VSTS-35"
        />
      </StyledIssueSyncList>
    ))
  );

const StyledIssueSyncList = styled('div')`
  max-width: 300px;
  margin: 0 auto;
  background: #fff;
  padding: ${space(1)};
  box-shadow: ${p => p.theme.dropShadowHeavy};
`;
