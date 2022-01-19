import * as React from 'react';

import Button from 'sentry/components/button';

const ActionButton = (props: React.ComponentProps<typeof Button>) => (
  <Button size="xsmall" {...props} />
);

export default ActionButton;
