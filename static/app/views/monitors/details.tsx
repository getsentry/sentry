import {Fragment, useCallback, useState} from 'react';
import styled from '@emotion/styled';
import sortBy from 'lodash/sortBy';

import {
  deleteMonitorProcessingErrorByType,
  updateMonitor,
} from 'sentry/actionCreators/monitors';
import {Alert} from 'sentry/components/core/alert';
import * as Layout from 'sentry/components/layouts/thirds';
import LoadingError from 'sentry/components/loadingError';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {DatePageFilter} from 'sentry/components/organizations/datePageFilter';
import {EnvironmentPageFilter} from 'sentry/components/organizations/environmentPageFilter';
import PageFilterBar from 'sentry/components/organizations/pageFilterBar';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {RouteComponentProps} from 'sentry/types/legacyReactRouter';
import {setApiQueryData, useApiQuery, useQueryClient} from 'sentry/utils/queryClient';
import useApi from 'sentry/utils/useApi';
import useOrganization from 'sentry/utils/useOrganization';

import {DetailsSidebar} from './components/detailsSidebar';
import {DetailsTimeline} from './components/detailsTimeline';
import {MonitorCheckIns} from './components/monitorCheckIns';
import {MonitorHeader} from './components/monitorHeader';
import {MonitorIssues} from './components/monitorIssues';
import {MonitorStats} from './components/monitorStats';
import {MonitorOnboarding} from './components/onboarding';
import {MonitorProcessingErrors} from './components/processingErrors/monitorProcessingErrors';
import {makeMonitorErrorsQueryKey} from './components/processingErrors/utils';
import {StatusToggleButton} from './components/statusToggleButton';
import type {
  CheckinProcessingError,
  Monitor,
  MonitorBucket,
  ProcessingErrorType,
} from './types';
import {makeMonitorDetailsQueryKey} from './utils';

const DEFAULT_POLL_INTERVAL_MS = 5000;

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
      return hasLastCheckIn(monitorData) ? false : DEFAULT_POLL_INTERVAL_MS;
    },
  });

  const {data: checkinErrors, refetch: refetchErrors} = useApiQuery<
    CheckinProcessingError[]
  >(makeMonitorErrorsQueryKey(organization, params.projectId, params.monitorSlug), {
    staleTime: 0,
    refetchOnWindowFocus: true,
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

  function handleDismissError(errortype: ProcessingErrorType) {
    deleteMonitorProcessingErrorByType(
      api,
      organization.slug,
      params.projectId,
      params.monitorSlug,
      errortype
    );
    refetchErrors();
  }

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
    <SentryDocumentTitle title={`${monitor.name} — Crons`}>
      <Layout.Page>
        <MonitorHeader
          monitor={monitor}
          orgSlug={organization.slug}
          onUpdate={onUpdate}
        />
        <Layout.Body>
          <Layout.Main>
            <StyledPageFilterBar condensed>
              <DatePageFilter />
              <EnvironmentPageFilter />
            </StyledPageFilterBar>
            {monitor.status === 'disabled' && (
              <Alert.Container>
                <Alert
                  type="muted"
                  showIcon
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
              <MonitorProcessingErrors
                checkinErrors={checkinErrors}
                onDismiss={handleDismissError}
              >
                {t('Errors were encountered while ingesting check-ins for this monitor')}
              </MonitorProcessingErrors>
            )}
            {!hasLastCheckIn(monitor) ? (
              <MonitorOnboarding monitor={monitor} />
            ) : (
              <Fragment>
                <DetailsTimeline monitor={monitor} onStatsLoaded={checkHasUnknown} />
                <MonitorStats monitor={monitor} monitorEnvs={monitor.environments} />
                <MonitorIssues monitor={monitor} monitorEnvs={monitor.environments} />
                <MonitorCheckIns monitor={monitor} monitorEnvs={monitor.environments} />
              </Fragment>
            )}
          </Layout.Main>
          <Layout.Side>
            <DetailsSidebar
              monitorEnv={envsSortedByLastCheck[envsSortedByLastCheck.length - 1]}
              monitor={monitor}
              showUnknownLegend={showUnknownLegend}
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
