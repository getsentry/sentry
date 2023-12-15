import {Fragment} from 'react';
import {RouteComponentProps} from 'react-router';
import styled from '@emotion/styled';
import sortBy from 'lodash/sortBy';

import {updateMonitor} from 'sentry/actionCreators/monitors';
import Alert from 'sentry/components/alert';
import * as Layout from 'sentry/components/layouts/thirds';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {DatePageFilter} from 'sentry/components/organizations/datePageFilter';
import {EnvironmentPageFilter} from 'sentry/components/organizations/environmentPageFilter';
import PageFilterBar from 'sentry/components/organizations/pageFilterBar';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {setApiQueryData, useApiQuery, useQueryClient} from 'sentry/utils/queryClient';
import useApi from 'sentry/utils/useApi';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';
import {CronDetailsTimeline} from 'sentry/views/monitors/components/cronDetailsTimeline';
import DetailsSidebar from 'sentry/views/monitors/components/detailsSidebar';

import MonitorCheckIns from './components/monitorCheckIns';
import MonitorHeader from './components/monitorHeader';
import MonitorIssues from './components/monitorIssues';
import MonitorStats from './components/monitorStats';
import MonitorOnboarding from './components/onboarding';
import {StatusToggleButton} from './components/statusToggleButton';
import {Monitor} from './types';

const DEFAULT_POLL_INTERVAL_MS = 5000;

type Props = RouteComponentProps<{monitorSlug: string}, {}>;

function hasLastCheckIn(monitor: Monitor) {
  return monitor.environments.some(e => e.lastCheckIn);
}

function MonitorDetails({params, location}: Props) {
  const api = useApi();
  const {selection} = usePageFilters();

  const organization = useOrganization();
  const queryClient = useQueryClient();

  // TODO(epurkhiser): For now we just use the fist environment OR production
  // if we have all environments selected
  const environment = selection.environments[0];

  const queryKey = [
    `/organizations/${organization.slug}/monitors/${params.monitorSlug}/`,
    {query: {...location.query, environment}},
  ] as const;

  const {data: monitor} = useApiQuery<Monitor>(queryKey, {
    staleTime: 0,
    refetchOnWindowFocus: true,
    // Refetches while we are waiting for the user to send their first check-in
    refetchInterval: data => {
      if (!data) {
        return false;
      }
      const [monitorData] = data;
      return hasLastCheckIn(monitorData) ? false : DEFAULT_POLL_INTERVAL_MS;
    },
  });

  function onUpdate(data: Monitor) {
    const updatedMonitor = {
      ...data,
      // TODO(davidenwang): This is a bit of a hack, due to the PUT request
      // which pauses/unpauses a monitor not returning monitor environments
      // we should reuse the environments retrieved from the initial request
      environments: monitor?.environments,
    };
    setApiQueryData(queryClient, queryKey, updatedMonitor);
  }

  const handleUpdate = async (data: Partial<Monitor>) => {
    if (monitor === undefined) {
      return;
    }
    const resp = await updateMonitor(api, organization.slug, monitor.slug, data);
    onUpdate(resp);
  };

  if (!monitor) {
    return (
      <Layout.Page>
        <LoadingIndicator />
      </Layout.Page>
    );
  }

  const envsSortedByLastCheck = sortBy(monitor.environments, e => e.lastCheckIn);

  return (
    <SentryDocumentTitle title={`Crons — ${monitor.name}`}>
      <Layout.Page>
        <MonitorHeader monitor={monitor} orgId={organization.slug} onUpdate={onUpdate} />
        <Layout.Body>
          <Layout.Main>
            <StyledPageFilterBar condensed>
              <DatePageFilter />
              <EnvironmentPageFilter />
            </StyledPageFilterBar>
            {monitor.status === 'disabled' && (
              <Alert
                type="muted"
                showIcon
                trailingItems={
                  <StatusToggleButton
                    monitor={monitor}
                    size="xs"
                    onClick={() => handleUpdate({status: 'active'})}
                  >
                    {t('Reactivate')}
                  </StatusToggleButton>
                }
              >
                {t('This monitor is disabled and is not accepting check-ins.')}
              </Alert>
            )}
            {!hasLastCheckIn(monitor) ? (
              <MonitorOnboarding monitor={monitor} />
            ) : (
              <Fragment>
                <CronDetailsTimeline organization={organization} monitor={monitor} />
                <MonitorStats
                  orgSlug={organization.slug}
                  monitor={monitor}
                  monitorEnvs={monitor.environments}
                />

                <MonitorIssues
                  orgSlug={organization.slug}
                  monitor={monitor}
                  monitorEnvs={monitor.environments}
                />

                <MonitorCheckIns
                  orgSlug={organization.slug}
                  monitor={monitor}
                  monitorEnvs={monitor.environments}
                />
              </Fragment>
            )}
          </Layout.Main>
          <Layout.Side>
            <DetailsSidebar
              monitorEnv={envsSortedByLastCheck[envsSortedByLastCheck.length - 1]}
              monitor={monitor}
            />
          </Layout.Side>
        </Layout.Body>
      </Layout.Page>
    </SentryDocumentTitle>
  );
}

const StyledPageFilterBar = styled(PageFilterBar)`
  margin-bottom: ${space(2)};
`;

export default MonitorDetails;
