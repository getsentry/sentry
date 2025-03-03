import {useEffect} from 'react';

import * as Layout from 'sentry/components/layouts/thirds';
import LoadingError from 'sentry/components/loadingError';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {t} from 'sentry/locale';
import type {Organization} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';
import {setApiQueryData, useApiQuery, useQueryClient} from 'sentry/utils/queryClient';
import normalizeUrl from 'sentry/utils/url/normalizeUrl';
import {useNavigate} from 'sentry/utils/useNavigate';
import usePageFilters from 'sentry/utils/usePageFilters';
import {useParams} from 'sentry/utils/useParams';
import {makeAlertsPathname} from 'sentry/views/alerts/pathnames';
import MonitorForm from 'sentry/views/monitors/components/monitorForm';
import type {Monitor} from 'sentry/views/monitors/types';
import {makeMonitorDetailsQueryKey} from 'sentry/views/monitors/utils';

type Props = {
  onChangeTitle: (data: string) => void;
  organization: Organization;
  project: Project;
};

export function CronRulesEdit({onChangeTitle, project, organization}: Props) {
  const {monitorSlug, projectId} = useParams<{
    monitorSlug: string;
    projectId: string;
  }>();

  const navigate = useNavigate();
  const {selection} = usePageFilters();
  const queryClient = useQueryClient();

  const queryKey = makeMonitorDetailsQueryKey(organization, project.slug, monitorSlug, {
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

  useEffect(
    () => onChangeTitle(monitor?.name ?? t('Editing Monitor')),
    [onChangeTitle, monitor?.name]
  );

  function onSubmitSuccess(data: Monitor) {
    setApiQueryData(queryClient, queryKey, data);
    navigate(
      normalizeUrl({
        pathname: makeAlertsPathname({
          path: `/rules/crons/${data.project.slug}/${data.slug}/details/`,
          organization,
        }),
        query: {
          environment: selection.environments,
          project: selection.projects,
        },
      })
    );
  }

  if (isPending) {
    return <LoadingIndicator />;
  }

  if (isError) {
    return <LoadingError onRetry={refetch} message={t('Failed to load monitor.')} />;
  }

  return (
    <Layout.Main fullWidth>
      <MonitorForm
        monitor={monitor}
        apiMethod="PUT"
        apiEndpoint={`/projects/${organization.slug}/${projectId}/monitors/${monitor.slug}/`}
        onSubmitSuccess={onSubmitSuccess}
      />
    </Layout.Main>
  );
}
