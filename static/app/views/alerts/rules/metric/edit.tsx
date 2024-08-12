import {useCallback} from 'react';
import type {RouteComponentProps} from 'react-router';

import {addErrorMessage} from 'sentry/actionCreators/indicator';
import {Alert} from 'sentry/components/alert';
import LoadingError from 'sentry/components/loadingError';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {t} from 'sentry/locale';
import type {Organization} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';
import {metric} from 'sentry/utils/analytics';
import {useApiQuery} from 'sentry/utils/queryClient';
import normalizeUrl from 'sentry/utils/url/normalizeUrl';
import {useNavigate} from 'sentry/utils/useNavigate';
import RuleForm from 'sentry/views/alerts/rules/metric/ruleForm';
import type {MetricRule} from 'sentry/views/alerts/rules/metric/types';

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

export function MetricRulesEdit({
  organization,
  params,
  project,
  userTeamIds,
  onChangeTitle,
  ...props
}: Props) {
  const navigate = useNavigate();

  const {
    isLoading,
    isError,
    data: rule,
    error,
  } = useApiQuery<MetricRule>(
    [`/organizations/${organization.slug}/alert-rules/${params.ruleId}/`],
    {
      staleTime: 0,
      retry: false,
      onSuccess: data => {
        onChangeTitle(data[0]?.name ?? '');
      },
      onError: ({responseText}) => {
        const {detail} = JSON.parse(responseText ?? '');
        if (detail) {
          addErrorMessage(detail);
        }
      },
    }
  );

  const handleSubmitSuccess = useCallback(() => {
    metric.endSpan({name: 'saveAlertRule'});
    navigate(
      normalizeUrl({
        pathname: `/organizations/${organization.slug}/alerts/rules/details/${params.ruleId}/`,
      })
    );
  }, [params.ruleId, navigate, organization.slug]);

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

  return (
    <RuleForm
      {...props}
      params={params}
      project={project}
      userTeamIds={userTeamIds}
      organization={organization}
      ruleId={params.ruleId}
      rule={rule}
      onSubmitSuccess={handleSubmitSuccess}
      disableProjectSelector
    />
  );
}
