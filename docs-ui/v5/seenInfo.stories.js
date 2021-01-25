import React from 'react';
import {text} from '@storybook/addon-knobs';
import {withInfo} from '@storybook/addon-info';

import SeenInfo from 'app/components/group/seenInfo';

export default {
  title: 'Features/Issues/Seen Info',
};

const organization = {
  slug: 'test-org',
};
const date = new Date();

export const Default = withInfo('default')(() => {
  return (
    <SeenInfo
      hasRelease={false}
      organization={organization}
      orgSlug="sentry-test"
      environment="prod"
      projectSlug="test-project"
      projectId="1"
      title={text('title', 'Last Seen')}
      date={date}
      dateGlobal={date}
    />
  );
});
