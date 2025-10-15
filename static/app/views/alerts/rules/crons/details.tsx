import {Fragment, useCallback, useState} from 'react';
import styled from '@emotion/styled';
import sortBy from 'lodash/sortBy';

import {updateMonitor} from 'sentry/actionCreators/monitors';
import {SectionHeading} from 'sentry/components/charts/styles';
import {Alert} from 'sentry/components/core/alert';
import * as Layout from 'sentry/components/layouts/thirds';
import LoadingError from 'sentry/components/loadingError';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {DatePageFilter} from 'sentry/components/organizations/datePageFilter';
import {EnvironmentPageFilter} from 'sentry/components/organizations/environmentPageFilter';
import PageFilterBar from 'sentry/components/organizations/pageFilterBar';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {TimezoneProvider, useTimezone} from 'sentry/components/timezoneProvider';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {RouteComponentProps} from 'sentry/types/legacyReactRouter';
import {setApiQueryData, useApiQuery, useQueryClient} from 'sentry/utils/queryClient';
import useApi from 'sentry/utils/useApi';
import useOrganization from 'sentry/utils/useOrganization';
import {DetailsSidebar} from 'sentry/views/insights/crons/components/detailsSidebar';
import {DetailsTimeline} from 'sentry/views/insights/crons/components/detailsTimeline';
import {MonitorCheckIns} from 'sentry/views/insights/crons/components/monitorCheckIns';
import {MonitorHeader} from 'sentry/views/insights/crons/components/monitorHeader';
import {MonitorIssues} from 'sentry/views/insights/crons/components/monitorIssues';
import {MonitorStats} from 'sentry/views/insights/crons/components/monitorStats';
import {MonitorOnboarding} from 'sentry/views/insights/crons/components/onboarding';
import {MonitorProcessingErrors} from 'sentry/views/insights/crons/components/processingErrors/monitorProcessingErrors';
import {StatusToggleButton} from 'sentry/views/insights/crons/components/statusToggleButton';
import {TimezoneOverride} from 'sentry/views/insights/crons/components/timezoneOverride';
import type {Monitor, MonitorBucket} from 'sentry/views/insights/crons/types';
import {useMonitorProcessingErrors} from 'sentry/views/insights/crons/useMonitorProcessingErrors';
import {makeMonitorDetailsQueryKey} from 'sentry/views/insights/crons/utils';

import {getMonitorRefetchInterval} from './utils';

type Props = RouteComponentProps<{monitorSlug: string; projectId: string}>;

function hasLastCheckIn(monitor: Monitor) {
  return monitor.environments.some(e => e.lastCheckIn);
}

function MonitorDetails({params, location}: Props) {
  const api = useApi();

  const organization = useOrganization();
  const queryClient = useQueryClient();

  const queryKey = makeMonitorDetailsQueryKey(
    organization,
    params.projectId,
    params.monitorSlug,
    {
      environment: location.query.environment,
    }
  );

  const {data: monitor, isError} = useApiQuery<Monitor>(queryKey, {
    staleTime: 0,
    refetchOnWindowFocus: true,
    // Refetches while we are waiting for the user to send their first check-in
    refetchInterval: query => {
      if (!query.state.data) {
        return false;
      }
      const [monitorData] = query.state.data;
      return getMonitorRefetchInterval(monitorData, new Date());
    },
  });

  const {checkinErrors, handleDismissError} = useMonitorProcessingErrors({
    organization,
    projectId: params.projectId,
    monitorSlug: params.monitorSlug,
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
    const resp = await updateMonitor(api, organization.slug, monitor, data);

    if (resp !== null) {
      onUpdate(resp);
    }
  };

  const userTimezone = useTimezone();
  const [timezoneOverride, setTimezoneOverride] = useState(userTimezone);

  // Only display the unknown legend when there are visible unknown check-ins
  // in the timeline
  const [showUnknownLegend, setShowUnknownLegend] = useState(false);

  const checkHasUnknown = useCallback((stats: MonitorBucket[]) => {
    const hasUnknown = stats.some(bucket =>
      Object.values(bucket[1]).some(envBucket => Boolean(envBucket.unknown))
    );
    setShowUnknownLegend(hasUnknown);
  }, []);

  if (isError) {
    return (
      <LoadingError message={t('The monitor you were looking for was not found.')} />
    );
  }

  if (!monitor) {
    return (
      <Layout.Page>
        <LoadingIndicator />
      </Layout.Page>
    );
  }

  const envsSortedByLastCheck = sortBy(monitor.environments, e => e.lastCheckIn);

  return (
    <Layout.Page>
      <SentryDocumentTitle title={`${monitor.name} — Alerts`} />
      <MonitorHeader monitor={monitor} orgSlug={organization.slug} onUpdate={onUpdate} />
      <Layout.Body>
        <TimezoneProvider timezone={timezoneOverride}>
          <Layout.Main>
            <MainActions>
              <StyledPageFilterBar condensed>
                <DatePageFilter maxPickableDays={30} />
                <EnvironmentPageFilter />
              </StyledPageFilterBar>
              <TimezoneOverride
                monitor={monitor}
                userTimezone={userTimezone}
                onTimezoneSelected={setTimezoneOverride}
              />
            </MainActions>
            {monitor.status === 'disabled' && (
              <Alert.Container>
                <Alert
                  type="muted"
                  trailingItems={
                    <StatusToggleButton
                      monitor={monitor}
                      size="xs"
                      onToggleStatus={status => handleUpdate({status})}
                    >
                      {t('Enable')}
                    </StatusToggleButton>
                  }
                >
                  {t('This monitor is disabled and is not accepting check-ins.')}
                </Alert>
              </Alert.Container>
            )}
            {!!checkinErrors?.length && (
              <Alert.Container>
                <MonitorProcessingErrors
                  checkinErrors={checkinErrors}
                  onDismiss={handleDismissError}
                >
                  {t(
                    'Errors were encountered while ingesting check-ins for this monitor'
                  )}
                </MonitorProcessingErrors>
              </Alert.Container>
            )}
            {hasLastCheckIn(monitor) ? (
              <Fragment>
                <DetailsTimeline monitor={monitor} onStatsLoaded={checkHasUnknown} />
                <MonitorStats monitor={monitor} monitorEnvs={monitor.environments} />
                <MonitorIssues monitor={monitor} monitorEnvs={monitor.environments} />
                <SectionHeading>{t('Recent Check-Ins')}</SectionHeading>
                <MonitorCheckIns
                  monitorSlug={monitor.slug}
                  monitorEnvs={monitor.environments}
                  project={monitor.project}
                />
              </Fragment>
            ) : (
              <MonitorOnboarding monitorSlug={monitor.slug} project={monitor.project} />
            )}
          </Layout.Main>
          <Layout.Side>
            <DetailsSidebar
              monitorEnv={envsSortedByLastCheck[envsSortedByLastCheck.length - 1]}
              monitor={monitor}
              showUnknownLegend={showUnknownLegend}
            />
          </Layout.Side>
        </TimezoneProvider>
      </Layout.Body>
    </Layout.Page>
  );
}

const MainActions = styled('div')`
  display: flex;
  gap: ${space(1)};
  justify-content: space-between;
  align-items: center;
`;

const StyledPageFilterBar = styled(PageFilterBar)`
  margin-bottom: ${space(2)};
`;

export default MonitorDetails;
