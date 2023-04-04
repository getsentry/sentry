import {Button, ButtonProps} from 'sentry/components/button';

const ActionButton = (props: ButtonProps): React.ReactElement => {
  return <Button size="xs" {...props} />;
};

export default ActionButton;
