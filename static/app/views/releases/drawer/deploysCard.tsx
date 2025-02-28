import styled from '@emotion/styled';

import {DateTime} from 'sentry/components/dateTime';
import EmptyStateWarning from 'sentry/components/emptyStateWarning';
import KeyValueData, {Card} from 'sentry/components/keyValueData';
import LoadingError from 'sentry/components/loadingError';
import Placeholder from 'sentry/components/placeholder';
import {t} from 'sentry/locale';
import type {Deploy} from 'sentry/types/release';
import {useApiQuery} from 'sentry/utils/queryClient';
import useOrganization from 'sentry/utils/useOrganization';
import useProjectFromSlug from 'sentry/utils/useProjectFromSlug';

interface DeploysCardProps {
  projectSlug: string;
  release: string;
}

function useReleaseDeploys({
  release,
  projectSlug,
}: {
  projectSlug: string;
  release: string;
}) {
  const organization = useOrganization();
  const project = useProjectFromSlug({organization, projectSlug});
  return useApiQuery<Deploy[]>(
    [
      `/organizations/${organization.slug}/releases/${encodeURIComponent(release)}/deploys/`,
      {
        query: {
          project: project!.id, // Should be disabled if project is undefined
        },
      },
    ],
    {
      staleTime: Infinity,
      enabled: !!project,
    }
  );
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
      <KeyValueData.CardPanel>
        <KeyValueData.Title>{t('Deploys')}</KeyValueData.Title>
        <InfoWrapper>
          {isLoading ? (
            <Placeholder height="20px" />
          ) : (
            <EmptyStateWarning small withIcon={false}>
              {t('No deploys found')}
            </EmptyStateWarning>
          )}
        </InfoWrapper>
      </KeyValueData.CardPanel>
    );
  }

  return (
    <Card
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

// Needed to make width 100%, because of CardPanel's grid
const InfoWrapper = styled('div')`
  grid-column: span 2;
`;
