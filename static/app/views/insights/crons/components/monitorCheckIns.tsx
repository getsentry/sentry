import {Fragment} from 'react';

import LoadingError from 'sentry/components/loadingError';
import Pagination from 'sentry/components/pagination';
import type {Project} from 'sentry/types/project';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import type {MonitorEnvironment} from 'sentry/views/insights/crons/types';
import {useMonitorCheckIns} from 'sentry/views/insights/crons/utils/useMonitorCheckIns';

import {MonitorCheckInsGrid} from './monitorCheckInsGrid';

type Props = {
  monitorEnvs: MonitorEnvironment[];
  monitorSlug: string;
  project: Project;
};

const PER_PAGE = 10;

export function MonitorCheckIns({monitorSlug, monitorEnvs, project}: Props) {
  const location = useLocation();
  const organization = useOrganization();

  const {
    data: checkInList,
    getResponseHeader,
    isPending,
    isError,
  } = useMonitorCheckIns(
    {
      orgSlug: organization.slug,
      projectSlug: project.slug,
      monitorIdOrSlug: monitorSlug,
      limit: PER_PAGE,
      expand: 'groups',
      environment: monitorEnvs.map(e => e.name),
      queryParams: {...location.query},
    },
    {
      refetchOnWindowFocus: true,
      refetchInterval: 60_000,
    }
  );

  if (isError) {
    return <LoadingError />;
  }

  const hasMultiEnv = monitorEnvs.length > 1;

  return (
    <Fragment>
      <MonitorCheckInsGrid
        checkIns={checkInList ?? []}
        isLoading={isPending}
        hasMultiEnv={hasMultiEnv}
        project={project}
      />
      <Pagination pageLinks={getResponseHeader?.('Link')} />
    </Fragment>
  );
}
