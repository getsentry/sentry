import {RouteComponentProps} from 'react-router';

import {Organization, Project} from 'sentry/types';
import {metric} from 'sentry/utils/analytics';
import EventView from 'sentry/utils/discover/eventView';
import {
  createDefaultRule,
  createRuleFromEventView,
  createRuleFromWizardTemplate,
} from 'sentry/views/alerts/rules/metric/constants';
import {WizardRuleTemplate} from 'sentry/views/alerts/wizard/options';

import RuleForm from './ruleForm';

type RouteParams = {
  orgId: string;
  projectId?: string;
  ruleId?: string;
};

type Props = {
  eventView: EventView | undefined;
  organization: Organization;
  project: Project;
  userTeamIds: string[];
  sessionId?: string;
  wizardTemplate?: WizardRuleTemplate;
} & RouteComponentProps<RouteParams, {}>;

/**
 * Show metric rules form with an empty rule. Redirects to alerts list after creation.
 */
function MetricRulesCreate(props: Props) {
  function handleSubmitSuccess(data: any) {
    const {router, project} = props;
    const {orgId} = props.params;
    const alertRuleId: string | undefined = data
      ? (data.id as string | undefined)
      : undefined;

    metric.endTransaction({name: 'saveAlertRule'});
    router.push(
      alertRuleId
        ? {pathname: `/organizations/${orgId}/alerts/rules/details/${alertRuleId}/`}
        : {
            pathname: `/organizations/${orgId}/alerts/rules/`,
            query: {project: project.id},
          }
    );
  }

  const {project, eventView, wizardTemplate, sessionId, userTeamIds, ...otherProps} =
    props;
  const defaultRule = eventView
    ? createRuleFromEventView(eventView)
    : wizardTemplate
    ? createRuleFromWizardTemplate(wizardTemplate)
    : createDefaultRule();

  const projectTeamIds = new Set(project.teams.map(({id}) => id));
  const defaultOwnerId = userTeamIds.find(id => projectTeamIds.has(id)) ?? null;
  defaultRule.owner = defaultOwnerId && `team:${defaultOwnerId}`;

  return (
    <RuleForm
      onSubmitSuccess={handleSubmitSuccess}
      rule={{...defaultRule, projects: [project.slug]}}
      sessionId={sessionId}
      project={project}
      userTeamIds={userTeamIds}
      {...otherProps}
    />
  );
}

export default MetricRulesCreate;
