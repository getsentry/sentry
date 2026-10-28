import {useEffect, useState} from 'react';

import {Button} from '@sentry/scraps/button';
import {Grid, Stack} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import {t} from 'sentry/locale';

import {ConsentFooter} from './consentNotice';
import type {OAuthApplication} from './types';

interface ConsentActionsProps {
  application: OAuthApplication;
  busy: boolean;
  canApprove: boolean;
  disabled: boolean;
  onDeny: () => void;
}

export function ConsentActions({
  application,
  busy,
  canApprove,
  disabled,
  onDeny,
}: ConsentActionsProps) {
  const [deadline, setDeadline] = useState<number | null>(null);
  const [remainingMs, setRemainingMs] = useState(1000);
  const canInteract = remainingMs === 0;

  useEffect(() => {
    if (deadline === null || canInteract) {
      return;
    }

    const interval = window.setInterval(() => {
      setRemainingMs(Math.max(0, deadline - performance.now()));
    }, 100);

    return () => window.clearInterval(interval);
  }, [deadline, canInteract]);

  // Delay approval after the first interaction to prevent click-through consent.
  useEffect(() => {
    const events = ['pointermove', 'pointerdown', 'keydown'] as const;
    const removeListeners = () => {
      events.forEach(event => document.removeEventListener(event, onFirstInteraction));
    };
    const onFirstInteraction = () => {
      removeListeners();
      setDeadline(performance.now() + 1000);
    };

    events.forEach(event => document.addEventListener(event, onFirstInteraction));

    return removeListeners;
  }, []);

  return (
    <Stack gap="lg">
      <Grid columns="3fr 1fr" gap="md" paddingTop="xl">
        <Button
          type="submit"
          aria-label={t('Authorize')}
          variant="primary"
          busy={busy}
          disabled={disabled || !canApprove || !canInteract}
        >
          <Text tabular variant="inherit">
            {deadline !== null && !canInteract
              ? t('Authorize (wait %ss)', (Math.ceil(remainingMs / 100) / 10).toFixed(1))
              : t('Authorize')}
          </Text>
        </Button>
        <Button disabled={disabled} onClick={onDeny}>
          {t('Deny')}
        </Button>
      </Grid>
      <ConsentFooter application={application} />
    </Stack>
  );
}
