import {Fragment} from 'react';

import LoadingError from 'sentry/components/loadingError';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import Pagination from 'sentry/components/pagination';
import {t} from 'sentry/locale';
import {decodeScalar} from 'sentry/utils/queryString';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import {useUptimeChecks} from 'sentry/views/insights/uptime/utils/useUptimeChecks';

import {UptimeChecksGrid} from './uptimeChecksGrid';

interface UptimeChecksTableProps {
  detectorId: string;
  projectSlug: string;
  traceSampling: boolean;
}

export function UptimeChecksTable({
  detectorId,
  projectSlug,
  traceSampling,
}: UptimeChecksTableProps) {
  const location = useLocation();
  const organization = useOrganization();

  const timeRange = {
    start: decodeScalar(location.query.start),
    end: decodeScalar(location.query.end),
    statsPeriod: decodeScalar(location.query.statsPeriod),
  };

  const {
    data: uptimeChecks,
    isError,
    isPending,
    getResponseHeader,
    refetch,
  } = useUptimeChecks(
    {
      orgSlug: organization.slug,
      projectSlug,
      detectorId,
      cursor: decodeScalar(location.query.cursor),
      ...timeRange,
      limit: 10,
    },
    {
      refetchOnWindowFocus: true,
      refetchInterval: 60_000,
    }
  );

  if (isError) {
    return <LoadingError message={t('Failed to load uptime checks')} onRetry={refetch} />;
  }

  return (
    <Fragment>
      {isPending ? (
        <LoadingIndicator />
      ) : (
        <UptimeChecksGrid traceSampling={traceSampling} uptimeChecks={uptimeChecks} />
      )}
      <Pagination pageLinks={getResponseHeader?.('Link')} />
    </Fragment>
  );
}
