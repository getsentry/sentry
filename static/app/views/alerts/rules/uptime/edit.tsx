import type {RouteComponentProps} from 'react-router';

import Alert from 'sentry/components/alert';
import LoadingError from 'sentry/components/loadingError';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {t} from 'sentry/locale';
import type {Organization} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';
import {useApiQuery} from 'sentry/utils/queryClient';
import type {UptimeAlert} from 'sentry/views/alerts/types';

type RouteParams = {
  projectId: string;
  ruleId: string;
};

type Props = {
  onChangeTitle: (data: string) => void;
  organization: Organization;
  project: Project;
  userTeamIds: string[];
} & RouteComponentProps<RouteParams, {}>;

export function UptimeRulesEdit({params, onChangeTitle, organization}: Props) {
  const {
    isLoading,
    isError,
    data: _rule,
    error,
  } = useApiQuery<UptimeAlert>(
    [`/projects/${organization.slug}/${params.projectId}/uptime/${params.ruleId}/`],
    {
      staleTime: 0,
      retry: false,
      onSuccess: data => onChangeTitle(data[0]?.name ?? ''),
    }
  );

  if (isLoading) {
    return <LoadingIndicator />;
  }

  if (isError) {
    if (error?.status === 404) {
      return (
        <Alert type="error" showIcon>
          {t('This alert rule could not be found.')}
        </Alert>
      );
    }

    return <LoadingError />;
  }

  return null;
}
