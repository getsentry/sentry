import {useState} from 'react';

import {Alert} from 'sentry/components/core/alert';
import {Button} from 'sentry/components/core/button';
import {IconClose} from 'sentry/icons';

export function DismissableInfoAlert({children}: {children: React.ReactNode}) {
  const [dismissed, setDismissed] = useState(false);
  return dismissed ? null : (
    <Alert
      variant="info"
      trailingItems={
        <Button
          aria-label="Dismiss banner"
          icon={<IconClose variant="accent" />}
          borderless
          onClick={() => setDismissed(true)}
          size="zero"
        />
      }
    >
      {children}
    </Alert>
  );
}
