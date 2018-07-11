import React from 'react';
import {storiesOf} from '@storybook/react';
import {withInfo} from '@storybook/addon-info';

import IssueSyncListElement from 'app/components/issueSyncListElement';

storiesOf('IssueSyncListElement', module)
  .add(
    'without issue added',
    withInfo('No issue id or url has been passed')(() => (
      <IssueSyncListElement integrationType="github" />
    ))
  )
  .add(
    'with issue added',
    withInfo('Both an Issue ID and URL have been passed')(() => (
      <IssueSyncListElement
        integrationType="github"
        extenalIssueLink="google.com"
        externalIssueId="GH-101"
      />
    ))
  );
