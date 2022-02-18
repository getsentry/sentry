import AlertBadge from 'sentry/components/alertBadge';
import {IncidentStatus} from 'sentry/views/alerts/types';

export default {
  title: 'Components/Alerts/Alert Badge',
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
