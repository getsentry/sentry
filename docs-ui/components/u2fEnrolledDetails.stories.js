import {action} from '@storybook/addon-actions';
import {boolean} from '@storybook/addon-knobs';
import {withInfo} from '@storybook/addon-info';

import U2fEnrolledDetails from 'app/views/settings/account/accountSecurity/components/u2fEnrolledDetails';

export default {
  title: 'UI/U2fEnrolledDetails',
};

export const U2FEnrolledDetails = withInfo('U2f details after enrollment', {
  propTablesExclude: ['Button'],
})(() => (
  <U2fEnrolledDetails
    isEnrolled={boolean('Is Enrolled', true)}
    id="u2f"
    devices={[
      {
        name: 'Device 1',
        timestamp: +new Date(),
      },
      {
        name: 'Home Key',
        timestamp: +new Date(),
      },
    ]}
    onRemoveU2fDevice={action('On Remove Device')}
  />
));

U2FEnrolledDetails.story = {
  name: 'U2fEnrolledDetails',
};
