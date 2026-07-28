import {Stack} from '@sentry/scraps/layout';

import {DateTime} from 'sentry/components/dateTime';
import {EmptyStateWarning} from 'sentry/components/emptyStateWarning';
import {KeyValue, KeyValuePanel} from 'sentry/components/keyValue';
import {LoadingError} from 'sentry/components/loadingError';
import {Placeholder} from 'sentry/components/placeholder';
import {t} from 'sentry/locale';
import {useReleaseDeploys} from 'sentry/views/explore/releases/utils/useReleaseDeploys';

interface DeploysCardProps {
  projectSlug: string | undefined;
  release: string;
}

export function DeploysCard({release, projectSlug}: DeploysCardProps) {
  const {
    isLoading,
    isError,
    refetch,
    data: deploys,
  } = useReleaseDeploys({projectSlug, release});

  if (isError) {
    return <LoadingError onRetry={refetch} />;
  }

  if (isLoading || !deploys?.length) {
    return (
      <KeyValuePanel>
        <Stack gap="sm">
          <KeyValue.Title>{t('Deploys')}</KeyValue.Title>
          {isLoading ? (
            <Placeholder height="20px" />
          ) : (
            <EmptyStateWarning small withIcon={false}>
              {t('No deploys found')}
            </EmptyStateWarning>
          )}
        </Stack>
      </KeyValuePanel>
    );
  }

  return (
    <KeyValue
      title={t('Deploys')}
      items={deploys.map(deploy => ({
        key: deploy.environment,
        value: <DateTime date={deploy.dateFinished} />,
      }))}
      card
      layout="detail"
    />
  );
}

// Needed to make width 100%, because of CardPanel's grid
