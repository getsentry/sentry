import styled from '@emotion/styled';

import {Breadcrumbs} from 'sentry/components/breadcrumbs';
import IdBadge from 'sentry/components/idBadge';
import * as Layout from 'sentry/components/layouts/thirds';
import LoadingError from 'sentry/components/loadingError';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {browserHistory} from 'sentry/utils/browserHistory';
import {setApiQueryData, useApiQuery, useQueryClient} from 'sentry/utils/queryClient';
import normalizeUrl from 'sentry/utils/url/normalizeUrl';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';
import {useParams} from 'sentry/utils/useParams';

import MonitorForm from './components/monitorForm';
import type {Monitor} from './types';
import {makeMonitorDetailsQueryKey} from './utils';

export default function EditMonitor() {
  const {monitorSlug, projectId} = useParams<{monitorSlug: string; projectId: string}>();
  const {selection} = usePageFilters();
  const organization = useOrganization();
  const queryClient = useQueryClient();

  const queryKey = makeMonitorDetailsQueryKey(organization, projectId, monitorSlug, {
    expand: ['alertRule'],
  });

  const {
    isPending,
    isError,
    data: monitor,
    refetch,
  } = useApiQuery<Monitor>(queryKey, {
    gcTime: 0,
    staleTime: 0,
  });

  function onSubmitSuccess(data: Monitor) {
    setApiQueryData(queryClient, queryKey, data);
    browserHistory.push(
      normalizeUrl({
        pathname: `/organizations/${organization.slug}/crons/${data.project.slug}/${data.slug}/`,
        query: {
          environment: selection.environments,
          project: selection.projects,
        },
      })
    );
  }

  function getTitle() {
    if (monitor) {
      return `${monitor.name} - Crons - ${organization.slug}`;
    }
    return `Crons - ${organization.slug}`;
  }

  if (isPending) {
    return <LoadingIndicator />;
  }

  if (isError) {
    return <LoadingError onRetry={refetch} message="Failed to load monitor." />;
  }

  return (
    <SentryDocumentTitle title={getTitle()}>
      <Layout.Page>
        <Layout.Header>
          <Layout.HeaderContent>
            <Breadcrumbs
              crumbs={[
                {
                  label: t('Crons'),
                  to: normalizeUrl(`/organizations/${organization.slug}/crons/`),
                },
                {
                  label: (
                    <MonitorBreadcrumb>
                      <IdBadge
                        disableLink
                        project={monitor.project}
                        avatarSize={16}
                        hideName
                        avatarProps={{hasTooltip: true, tooltip: monitor.project.slug}}
                      />
                      {monitor.name}
                    </MonitorBreadcrumb>
                  ),
                  to: normalizeUrl(
                    `/organizations/${organization.slug}/crons/${monitor.project.slug}/${monitor.slug}/`
                  ),
                },
                {
                  label: t('Edit'),
                },
              ]}
            />
            <Layout.Title>{t('Edit Monitor')}</Layout.Title>
          </Layout.HeaderContent>
        </Layout.Header>
        <Layout.Body>
          <Layout.Main fullWidth>
            <MonitorForm
              monitor={monitor}
              apiMethod="PUT"
              apiEndpoint={`/projects/${organization.slug}/${projectId}/monitors/${monitor.slug}/`}
              onSubmitSuccess={onSubmitSuccess}
            />
          </Layout.Main>
        </Layout.Body>
      </Layout.Page>
    </SentryDocumentTitle>
  );
}

const MonitorBreadcrumb = styled('div')`
  display: flex;
  gap: ${space(1)};
  align-items: center;
`;
