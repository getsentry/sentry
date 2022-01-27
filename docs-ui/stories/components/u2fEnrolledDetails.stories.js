import {action} from '@storybook/addon-actions';

import U2fEnrolledDetails from 'sentry/views/settings/account/accountSecurity/components/u2fEnrolledDetails';

export default {
  title: 'Components/Tables/U2fEnrolledDetails',
};

export const U2FEnrolledDetails = ({isEnrolled}) => (
  <U2fEnrolledDetails
    isEnrolled={isEnrolled}
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
);

U2FEnrolledDetails.storyName = 'U2fEnrolledDetails';
U2FEnrolledDetails.args = {
  isEnrolled: true,
};
U2FEnrolledDetails.parameters = {
  docs: {
    description: {
      story: 'U2f details after enrollment',
    },
  },
};
