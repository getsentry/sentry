import {Button} from '@sentry/scraps/button';
import {Stack} from '@sentry/scraps/layout';

import {IconRefresh, IconWarning} from 'sentry/icons';
import {t} from 'sentry/locale';
import {EmptyStateText} from 'sentry/views/explore/tables/tracesTable/styles';

export function LogsRateLimitError({onRetry}: {onRetry?: () => void}) {
  return (
    <Stack align="center" gap="xl">
      <IconWarning variant="muted" size="lg" />
      <EmptyStateText size="md" textAlign="center">
        {t(
          'Your organization has had a lot of activity. Wait a few seconds and then try again.'
        )}
      </EmptyStateText>
      {onRetry && (
        <Button size="sm" icon={<IconRefresh />} onClick={onRetry}>
          {t('Retry')}
        </Button>
      )}
    </Stack>
  );
}
