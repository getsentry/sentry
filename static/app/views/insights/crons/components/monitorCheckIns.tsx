import {Fragment} from 'react';
import styled from '@emotion/styled';

import {SectionHeading} from 'sentry/components/charts/styles';
import LoadingError from 'sentry/components/loadingError';
import Pagination from 'sentry/components/pagination';
import {PanelTable} from 'sentry/components/panels/panelTable';
import Placeholder from 'sentry/components/placeholder';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import type {Monitor, MonitorEnvironment} from 'sentry/views/insights/crons/types';
import {useMonitorCheckIns} from 'sentry/views/insights/crons/utils/useMonitorCheckIns';

import {CheckInRow} from './checkInRow';

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

  const headers = [
    t('Status'),
    t('Started'),
    t('Completed'),
    t('Duration'),
    t('Issues'),
    ...(hasMultiEnv ? [t('Environment')] : []),
    t('Expected At'),
  ];

  return (
    <Fragment>
      <SectionHeading>{t('Recent Check-Ins')}</SectionHeading>
      <PanelTable
        headers={headers}
        isEmpty={!isPending && checkInList.length === 0}
        emptyMessage={t('No check-ins have been recorded for this time period.')}
      >
        {isPending
          ? [...new Array(PER_PAGE)].map((_, i) => (
              <RowPlaceholder key={i}>
                <Placeholder height="2rem" />
              </RowPlaceholder>
            ))
          : checkInList.map(checkIn => (
              <CheckInRow
                key={checkIn.id}
                monitor={monitor}
                checkIn={checkIn}
                hasMultiEnv={hasMultiEnv}
              />
            ))}
      </PanelTable>
      <Pagination pageLinks={getResponseHeader?.('Link')} />
    </Fragment>
  );
}

const RowPlaceholder = styled('div')`
  grid-column: 1 / -1;
  padding: ${space(1)};

  &:not(:last-child) {
    border-bottom: solid 1px ${p => p.theme.innerBorder};
  }
`;
