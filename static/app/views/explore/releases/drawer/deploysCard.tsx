import {DateTime} from 'sentry/components/dateTime';
import {EmptyStateWarning} from 'sentry/components/emptyStateWarning';
import {LoadingError} from 'sentry/components/loadingError';
import {Placeholder} from 'sentry/components/placeholder';
import {KeyValueTableCard} from 'sentry/components/tables/keyValueTable';
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
      <KeyValueTableCard title={t('Deploys')}>
        {isLoading ? (
          <Placeholder height="20px" />
        ) : (
          <EmptyStateWarning small withIcon={false}>
            {t('No deploys found')}
          </EmptyStateWarning>
        )}
      </KeyValueTableCard>
    );
  }

  return (
    <KeyValueTableCard
      title={t('Deploys')}
      contentItems={deploys.map(deploy => ({
        item: {
          key: deploy.environment,
          subject: deploy.environment,
          value: <DateTime date={deploy.dateFinished} />,
        },
      }))}
    />
  );
}
