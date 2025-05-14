import {Fragment} from 'react';

import {SectionHeading} from 'sentry/components/charts/styles';
import LoadingError from 'sentry/components/loadingError';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import Pagination from 'sentry/components/pagination';
import {t} from 'sentry/locale';
import {decodeScalar} from 'sentry/utils/queryString';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import {useUptimeChecks} from 'sentry/views/insights/uptime/utils/useUptimeChecks';

import type {UptimeRule} from './types';
import {UptimeChecksGrid} from './uptimeChecksGrid';

interface UptimeChecksTableProps {
  uptimeRule: UptimeRule;
}

export function UptimeChecksTable({uptimeRule}: UptimeChecksTableProps) {
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
  } = useUptimeChecks({
    orgSlug: organization.slug,
    projectSlug: uptimeRule.projectSlug,
    uptimeAlertId: uptimeRule.id,
    cursor: decodeScalar(location.query.cursor),
    ...timeRange,
    limit: 10,
  });

  if (isError) {
    return <LoadingError message={t('Failed to load uptime checks')} onRetry={refetch} />;
  }

  return (
    <Fragment>
      <SectionHeading>{t('Checks List')}</SectionHeading>
      {isPending ? (
        <LoadingIndicator />
      ) : (
        <UptimeChecksGrid uptimeRule={uptimeRule} uptimeChecks={uptimeChecks} />
      )}
      <Pagination pageLinks={getResponseHeader?.('Link')} />
    </Fragment>
  );
}
