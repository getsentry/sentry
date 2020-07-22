import React from 'react';
import {withInfo} from '@storybook/addon-info';

import DeployBadge from 'app/components/deployBadge';

const deploy = {
  name: '85fedddce5a61a58b160fa6b3d6a1a8451e94eb9 to prod',
  url: null,
  environment: 'production',
  dateStarted: null,
  dateFinished: '2020-05-11T18:12:00.025928Z',
  id: '6348842',
};

export default {
  title: 'UI/DeployBadge',
};

export const Default = withInfo('Used to display deploy in a "badge"')(() => (
  <div>
    <div>
      <DeployBadge deploy={deploy} orgSlug="sentry" version="1.2.3" />
    </div>
    <div>
      <DeployBadge
        deploy={{...deploy, environment: 'verylongenvironment'}}
        orgSlug="sentry"
        version="1.2.3"
      />
    </div>
    <div>
      <DeployBadge deploy={deploy} />
    </div>
  </div>
));

Default.story = {
  name: 'default',
};
