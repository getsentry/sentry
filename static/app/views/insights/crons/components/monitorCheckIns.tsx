import {Fragment} from 'react';

import {SectionHeading} from 'sentry/components/charts/styles';
import LoadingError from 'sentry/components/loadingError';
import Pagination from 'sentry/components/pagination';
import {t} from 'sentry/locale';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import type {Monitor, MonitorEnvironment} from 'sentry/views/insights/crons/types';
import {useMonitorCheckIns} from 'sentry/views/insights/crons/utils/useMonitorCheckIns';

import {MonitorCheckInsGrid} from './monitorCheckInsGrid';

type Props = {
  monitor: Monitor;
  monitorEnvs: MonitorEnvironment[];
};

const PER_PAGE = 10;

export function MonitorCheckIns({monitor, monitorEnvs}: Props) {
  const location = useLocation();
  const organization = useOrganization();

  const {
    data: checkInList,
    getResponseHeader,
    isPending,
    isError,
  } = useMonitorCheckIns({
    orgSlug: organization.slug,
    projectSlug: monitor.project.slug,
    monitorIdOrSlug: monitor.slug,
    limit: PER_PAGE,
    expand: 'groups',
    environment: monitorEnvs.map(e => e.name),
    queryParams: {...location.query},
  });

  if (isError) {
    return <LoadingError />;
  }

  const hasMultiEnv = monitorEnvs.length > 1;

  return (
    <Fragment>
      <SectionHeading>{t('Recent Check-Ins')}</SectionHeading>
      <MonitorCheckInsGrid
        checkIns={checkInList ?? []}
        isLoading={isPending}
        hasMultiEnv={hasMultiEnv}
        project={monitor.project}
      />
      <Pagination pageLinks={getResponseHeader?.('Link')} />
    </Fragment>
  );
}
