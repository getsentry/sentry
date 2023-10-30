import {Button, ButtonProps} from 'sentry/components/button';

function ActionButton(props: ButtonProps): React.ReactElement {
  return <Button size="xs" {...props} />;
}

export default ActionButton;
