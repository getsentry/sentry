import type {RouteComponentProps} from 'react-router';
import pick from 'lodash/pick';

import * as Layout from 'sentry/components/layouts/thirds';
import LoadingError from 'sentry/components/loadingError';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import type {Project} from 'sentry/types';
import EventView from 'sentry/utils/discover/eventView';
import {uniqueId} from 'sentry/utils/guid';
import {useApiQuery} from 'sentry/utils/queryClient';
import useOrganization from 'sentry/utils/useOrganization';
import {normalizeUrl} from 'sentry/utils/withDomainRequired';
import {
  DuplicateActionFields,
  DuplicateMetricFields,
  DuplicateTriggerFields,
} from 'sentry/views/alerts/rules/metric/constants';
import type {MetricRule} from 'sentry/views/alerts/rules/metric/types';
import type {WizardRuleTemplate} from 'sentry/views/alerts/wizard/options';

import RuleForm from './ruleForm';

interface MetricRuleDuplicateProps extends RouteComponentProps<{}, {}> {
  project: Project;
  userTeamIds: string[];
  eventView?: EventView;
  sessionId?: string;
  wizardTemplate?: WizardRuleTemplate;
}

/**
 * Show metric rules form with values from an existing rule.
 */
function MetricRuleDuplicate({
  project,
  sessionId,
  userTeamIds,
  ...otherProps
}: MetricRuleDuplicateProps) {
  const organization = useOrganization();
  const {
    data: duplicateTargetRule,
    isLoading,
    isError,
    refetch,
  } = useApiQuery<MetricRule>(
    [
      `/organizations/${organization.slug}/alert-rules/${otherProps.location.query.duplicateRuleId}/`,
    ],
    {staleTime: 0}
  );

  const handleSubmitSuccess = (data: any) => {
    const alertRuleId: string | undefined = data
      ? (data.id as string | undefined)
      : undefined;

    const target = alertRuleId
      ? {
          pathname: `/organizations/${organization.slug}/alerts/rules/details/${alertRuleId}/`,
        }
      : {
          pathname: `/organizations/${organization.slug}/alerts/rules/`,
          query: {project: project.id},
        };
    otherProps.router.push(normalizeUrl(target));
  };

  if (isLoading) {
    return <LoadingIndicator />;
  }

  if (isError) {
    return <LoadingError onRetry={refetch} />;
  }

  return (
    <Layout.Main>
      <RuleForm
        organization={organization}
        onSubmitSuccess={handleSubmitSuccess}
        rule={
          {
            ...pick(duplicateTargetRule, DuplicateMetricFields),
            triggers: duplicateTargetRule.triggers.map(trigger => ({
              ...pick(trigger, DuplicateTriggerFields),
              actions: trigger.actions.map(action => ({
                inputChannelId: null,
                integrationId: action.integrationId ?? undefined,
                options: null,
                sentryAppId: undefined,
                unsavedId: uniqueId(),
                unsavedDateCreated: new Date().toISOString(),
                ...pick(action, DuplicateActionFields),
              })),
            })),
            name: duplicateTargetRule.name + ' copy',
          } as MetricRule
        }
        sessionId={sessionId}
        project={project}
        userTeamIds={userTeamIds}
        isDuplicateRule
        {...otherProps}
      />
    </Layout.Main>
  );
}

export default MetricRuleDuplicate;
