import {useCallback, useEffect} from 'react';

import {addErrorMessage} from 'sentry/actionCreators/indicator';
import {Alert} from 'sentry/components/core/alert';
import LoadingError from 'sentry/components/loadingError';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {t} from 'sentry/locale';
import type {RouteComponentProps} from 'sentry/types/legacyReactRouter';
import type {Organization} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';
import {metric} from 'sentry/utils/analytics';
import normalizeUrl from 'sentry/utils/url/normalizeUrl';
import {useNavigate} from 'sentry/utils/useNavigate';
import {makeAlertsPathname} from 'sentry/views/alerts/pathnames';
import RuleForm from 'sentry/views/alerts/rules/metric/ruleForm';
import {useMetricRule} from 'sentry/views/alerts/rules/metric/utils/useMetricRule';

type RouteParams = {
  projectId: string;
  ruleId: string;
};

type Props = {
  onChangeTitle: (data: string) => void;
  organization: Organization;
  project: Project;
  userTeamIds: string[];
} & RouteComponentProps<RouteParams>;

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
    isPending,
    isError,
    data: rule,
    error,
  } = useMetricRule(
    {
      orgSlug: organization.slug,
      ruleId: params.ruleId,
    },
    {refetchOnMount: true}
  );

  useEffect(() => {
    if (!isPending && rule) {
      onChangeTitle(rule.name ?? '');
    }
  }, [onChangeTitle, isPending, rule]);

  useEffect(() => {
    if (isError && error?.responseText) {
      try {
        const {detail} = JSON.parse(error.responseText);
        if (detail) {
          addErrorMessage(detail);
        }
      } catch {
        // Ignore
      }
    }
  }, [isError, error]);

  const handleSubmitSuccess = useCallback(() => {
    metric.endSpan({name: 'saveAlertRule'});
    navigate(
      normalizeUrl({
        pathname: makeAlertsPathname({
          path: `/rules/details/${params.ruleId}/`,
          organization,
        }),
      })
    );
  }, [navigate, params.ruleId, organization]);

  if (isPending) {
    return <LoadingIndicator />;
  }

  if (isError) {
    if (error?.status === 404) {
      return (
        <Alert.Container>
          <Alert type="error" showIcon>
            {t('This alert rule could not be found.')}
          </Alert>
        </Alert.Container>
      );
    }

    return <LoadingError />;
  }

  return (
    <RuleForm
      {...props}
      // HACK: gnarly workaround to force the component to re-render when rule updates
      // Remove this once the RuleForm component is refactored to use `react-query`
      key={JSON.stringify(rule)}
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
