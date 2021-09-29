import AlertBar from 'app/components/alertBar';

export default {
  title: 'Components/Alerts/Alert Bar',
  component: AlertBar,
};

export const Default = ({...args}) => <AlertBar {...args}>Alert message</AlertBar>;
