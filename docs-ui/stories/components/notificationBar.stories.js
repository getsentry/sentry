import NotificationBar from 'sentry/components/alerts/notificationBar';

export default {
  title: 'Components/Alerts/Notification Bar',
  component: NotificationBar,
};

export const Default = ({...args}) => (
  <NotificationBar {...args}>Alert message</NotificationBar>
);
