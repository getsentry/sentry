import {Button} from '@sentry/scraps/button';
import {Grid, Stack} from '@sentry/scraps/layout';

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
  return (
    <Stack gap="lg">
      <Grid columns="3fr 1fr" gap="md" paddingTop="xl">
        <Button
          type="submit"
          variant="primary"
          busy={busy}
          disabled={disabled || !canApprove}
        >
          {t('Authorize')}
        </Button>
        <Button disabled={disabled} onClick={onDeny}>
          {t('Deny')}
        </Button>
      </Grid>
      <ConsentFooter application={application} />
    </Stack>
  );
}
