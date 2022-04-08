import PageAlertBar from 'sentry/components/pageAlertBar';

export default {
  title: 'Components/Alerts/Alert Bar',
  component: PageAlertBar,
};

export const Default = ({...args}) => (
  <PageAlertBar {...args}>Alert message</PageAlertBar>
);
