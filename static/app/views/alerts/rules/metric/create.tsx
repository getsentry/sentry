import type {RouteComponentProps} from 'sentry/types/legacyReactRouter';
import type {Organization} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';
import {metric} from 'sentry/utils/analytics';
import type EventView from 'sentry/utils/discover/eventView';
import {decodeScalar} from 'sentry/utils/queryString';
import normalizeUrl from 'sentry/utils/url/normalizeUrl';
import {
  createDefaultRule,
  createRuleFromEventView,
  createRuleFromWizardTemplate,
  getAlertTimeWindow,
} from 'sentry/views/alerts/rules/metric/constants';
import type {WizardRuleTemplate} from 'sentry/views/alerts/wizard/options';

import RuleForm from './ruleForm';

type RouteParams = {
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
    const {organization, project, router} = props;
    const alertRuleId: string | undefined = data
      ? (data.id as string | undefined)
      : undefined;

    metric.endSpan({name: 'saveAlertRule'});
    const target = alertRuleId
      ? {
          pathname: `/organizations/${organization.slug}/alerts/rules/details/${alertRuleId}/`,
        }
      : {
          pathname: `/organizations/${organization.slug}/alerts/rules/`,
          query: {project: project.id},
        };
    router.push(normalizeUrl(target));
  }

  const {
    project,
    eventView,
    wizardTemplate,
    sessionId,
    userTeamIds,
    location,
    ...otherProps
  } = props;
  const defaultRule = eventView
    ? createRuleFromEventView(eventView)
    : wizardTemplate
      ? createRuleFromWizardTemplate(wizardTemplate)
      : createDefaultRule();

  const projectTeamIds = new Set(project.teams.map(({id}) => id));
  const defaultOwnerId = userTeamIds.find(id => projectTeamIds.has(id)) ?? null;
  defaultRule.owner = defaultOwnerId && `team:${defaultOwnerId}`;
  const environment = decodeScalar(location?.query?.environment) ?? null;
  const interval = decodeScalar(location?.query?.interval) ?? undefined;
  defaultRule.timeWindow = getAlertTimeWindow(interval) ?? defaultRule.timeWindow;

  return (
    <RuleForm
      onSubmitSuccess={handleSubmitSuccess}
      rule={{...defaultRule, environment, projects: [project.slug]}}
      sessionId={sessionId}
      project={project}
      userTeamIds={userTeamIds}
      eventView={eventView}
      location={location}
      {...otherProps}
    />
  );
}

export default MetricRulesCreate;
