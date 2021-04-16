import React from 'react';

import AlertBadge from 'app/views/alerts/alertBadge';
import {IncidentStatus} from 'app/views/alerts/types';

export default {
  title: 'Features/Alerts/AlertBadge',
  component: AlertBadge,
  args: {
    status: 0,
    hideText: false,
    isIssue: false,
  },
  argTypes: {
    status: {
      control: {
        type: 'radio',
        options: Object.values(IncidentStatus).filter(Number.isInteger),
        labels: IncidentStatus,
      },
    },
  },
};

export const Default = ({...args}) => <AlertBadge {...args} />;
