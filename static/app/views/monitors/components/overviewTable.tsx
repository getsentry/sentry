import {Fragment} from 'react';
import styled from '@emotion/styled';

import Pagination from 'sentry/components/pagination';
import {PanelTable} from 'sentry/components/panels';
import {t} from 'sentry/locale';
import {setApiQueryData, useQueryClient} from 'sentry/utils/queryClient';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';

import {Monitor, MonitorEnvironment} from '../types';
import {makeMonitorListQueryKey} from '../utils';

import {MonitorRow} from './row';

interface Props {
  monitorList: Monitor[];
  monitorListPageLinks?: string | null;
}

export function OverviewTable({monitorList, monitorListPageLinks}: Props) {
  const location = useLocation();
  const organization = useOrganization();
  const queryClient = useQueryClient();

  const queryKey = makeMonitorListQueryKey(organization, location);

  const renderMonitorRow = (monitor: Monitor, monitorEnv?: MonitorEnvironment) => (
    <MonitorRow
      key={`${monitor.slug}-${monitorEnv?.name ?? 'no-env'}`}
      monitor={monitor}
      monitorEnv={monitorEnv}
      onDelete={deletedEnv => {
        if (deletedEnv) {
          if (!monitorList) {
            return;
          }
          const deletedEnvMonitor = monitorList.find(m => m.slug === monitor.slug);
          if (!deletedEnvMonitor) {
            return;
          }
          deletedEnvMonitor.environments = deletedEnvMonitor.environments.filter(
            e => e.name !== deletedEnv.name
          );
          setApiQueryData(queryClient, queryKey, monitorList);
        } else {
          setApiQueryData(
            queryClient,
            queryKey,
            monitorList?.filter(m => m.slug !== monitor.slug)
          );
        }
      }}
      organization={organization}
    />
  );

  return (
    <Fragment>
      <StyledPanelTable
        headers={[
          t('Monitor Name'),
          t('Status'),
          t('Schedule'),
          t('Next Checkin'),
          t('Project'),
          t('Environment'),
          t('Actions'),
        ]}
      >
        {monitorList
          ?.map(monitor =>
            monitor.environments.length > 0
              ? monitor.environments.map(monitorEnv =>
                  renderMonitorRow(monitor, monitorEnv)
                )
              : renderMonitorRow(monitor)
          )
          .flat()}
      </StyledPanelTable>
      {monitorListPageLinks && <Pagination pageLinks={monitorListPageLinks} />}
    </Fragment>
  );
}

const StyledPanelTable = styled(PanelTable)`
  grid-template-columns: 1fr max-content 1fr max-content max-content max-content max-content;
`;
