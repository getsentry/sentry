import type {ComponentProps} from 'react';

import {Button} from 'sentry/components/button';

export function WidgetButton(props: Omit<ComponentProps<typeof Button>, 'size'>) {
  return (
    <Button {...props} size="xs">
      {props.children}
    </Button>
  );
}
