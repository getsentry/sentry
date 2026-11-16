import {Fragment} from 'react';
import {useQuery} from '@tanstack/react-query';
import {useQueryStates} from 'nuqs';

import {Pagination} from '@sentry/scraps/pagination';

import {LoadingError} from 'sentry/components/loadingError';
import {LoadingIndicator} from 'sentry/components/loadingIndicator';
import {t} from 'sentry/locale';
import type {Project} from 'sentry/types/project';
import {selectJsonWithHeaders} from 'sentry/utils/api/apiOptions';
import {getPaginationProps} from 'sentry/utils/pagination';
import {useOrganization} from 'sentry/utils/useOrganization';
import {parseAsScalar} from 'sentry/views/explore/queryParams/parsers';
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
  const organization = useOrganization();
  const [{cursor, start, end, statsPeriod}] = useQueryStates({
    cursor: parseAsScalar,
    start: parseAsScalar,
    end: parseAsScalar,
    statsPeriod: parseAsScalar,
  });

  const {data, isError, isPending, refetch} = useQuery({
    ...uptimeChecksApiOptions({
      orgSlug: organization.slug,
      projectSlug: project.slug,
      detectorId,
      cursor: cursor ?? undefined,
      start: start ?? undefined,
      end: end ?? undefined,
      statsPeriod: statsPeriod ?? undefined,
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
      <Pagination {...getPaginationProps(data?.headers.Link)} />
    </Fragment>
  );
}
