import * as React from 'react';

import Button, {ButtonProps} from 'sentry/components/button';

function ActionButton(props: ButtonProps): React.ReactElement {
  return <Button size="xsmall" {...props} />;
}

export default ActionButton;
