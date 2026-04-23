import {Fragment} from 'react';
import {useQuery} from '@tanstack/react-query';

import {LoadingError} from 'sentry/components/loadingError';
import {LoadingIndicator} from 'sentry/components/loadingIndicator';
import {Pagination} from 'sentry/components/pagination';
import {t} from 'sentry/locale';
import type {Project} from 'sentry/types/project';
import {selectJsonWithHeaders} from 'sentry/utils/api/apiOptions';
import {decodeScalar} from 'sentry/utils/queryString';
import {useLocation} from 'sentry/utils/useLocation';
import {useOrganization} from 'sentry/utils/useOrganization';
import {uptimeChecksApiOptions} from 'sentry/views/insights/uptime/utils/uptimeChecksApiOptions';

import {UptimeChecksGrid} from './uptimeChecksGrid';

interface UptimeChecksTableProps {
  detectorId: string;
  project: Project;
  traceSampling: boolean;
}

export function UptimeChecksTable({
  detectorId,
  project,
  traceSampling,
}: UptimeChecksTableProps) {
  const location = useLocation();
  const organization = useOrganization();

  const timeRange = {
    start: decodeScalar(location.query.start),
    end: decodeScalar(location.query.end),
    statsPeriod: decodeScalar(location.query.statsPeriod),
  };

  const {data, isError, isPending, refetch} = useQuery({
    ...uptimeChecksApiOptions({
      orgSlug: organization.slug,
      projectSlug: project.slug,
      detectorId,
      cursor: decodeScalar(location.query.cursor),
      ...timeRange,
      limit: 10,
    }),
    refetchOnWindowFocus: true,
    refetchInterval: 60_000,
    select: selectJsonWithHeaders,
  });

  if (isError) {
    return <LoadingError message={t('Failed to load uptime checks')} onRetry={refetch} />;
  }

  return (
    <Fragment>
      {isPending ? (
        <LoadingIndicator />
      ) : (
        <UptimeChecksGrid traceSampling={traceSampling} uptimeChecks={data?.json ?? []} />
      )}
      <Pagination pageLinks={data?.headers.Link} />
    </Fragment>
  );
}
