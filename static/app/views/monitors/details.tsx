import {Fragment} from 'react';
import {RouteComponentProps} from 'react-router';
import styled from '@emotion/styled';

import DatePageFilter from 'sentry/components/datePageFilter';
import * as Layout from 'sentry/components/layouts/thirds';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import PageFilterBar from 'sentry/components/organizations/pageFilterBar';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {space} from 'sentry/styles/space';
import {setApiQueryData, useApiQuery, useQueryClient} from 'sentry/utils/queryClient';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';

import MonitorCheckIns from './components/monitorCheckIns';
import MonitorHeader from './components/monitorHeader';
import MonitorIssues from './components/monitorIssues';
import MonitorStats from './components/monitorStats';
import MonitorOnboarding from './components/onboarding';
import {Monitor} from './types';

type Props = RouteComponentProps<{monitorSlug: string}, {}>;

function MonitorDetails({params, location}: Props) {
  const {selection} = usePageFilters();

  const organization = useOrganization();
  const queryClient = useQueryClient();

  // TODO(epurkhiser): For now we just use the fist environment OR production
  // if we have all environments selected
  const environment = selection.environments[0] ?? 'production';

  const queryKey = [
    `/organizations/${organization.slug}/monitors/${params.monitorSlug}/`,
    {query: {...location.query, environment}},
  ] as const;

  const {data: monitor} = useApiQuery<Monitor>(queryKey, {staleTime: 0});

  function onUpdate(data: Monitor) {
    setApiQueryData(queryClient, queryKey, data);
  }

  if (!monitor) {
    return (
      <Layout.Page>
        <LoadingIndicator />
      </Layout.Page>
    );
  }

  const monitorEnv = monitor.environments.find(env => env.name === environment);

  return (
    <SentryDocumentTitle title={`Crons - ${monitor.name}`}>
      <Layout.Page>
        <MonitorHeader
          monitor={monitor}
          monitorEnv={monitorEnv}
          orgId={organization.slug}
          onUpdate={onUpdate}
        />
        <Layout.Body>
          <Layout.Main fullWidth>
            {!monitorEnv?.lastCheckIn ? (
              <MonitorOnboarding orgId={organization.slug} monitor={monitor} />
            ) : (
              <Fragment>
                <StyledPageFilterBar condensed>
                  <DatePageFilter alignDropdown="left" />
                </StyledPageFilterBar>

                <MonitorStats
                  orgId={organization.slug}
                  monitor={monitor}
                  monitorEnv={monitorEnv}
                />

                <MonitorIssues
                  orgId={organization.slug}
                  monitor={monitor}
                  monitorEnv={monitorEnv}
                />

                <MonitorCheckIns
                  orgId={organization.slug}
                  monitor={monitor}
                  monitorEnv={monitorEnv}
                />
              </Fragment>
            )}
          </Layout.Main>
        </Layout.Body>
      </Layout.Page>
    </SentryDocumentTitle>
  );
}

const StyledPageFilterBar = styled(PageFilterBar)`
  margin-bottom: ${space(2)};
`;

export default MonitorDetails;
