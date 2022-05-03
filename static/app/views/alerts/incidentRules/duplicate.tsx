import {RouteComponentProps} from 'react-router';
import pick from 'lodash/pick';

import {Organization, Project} from 'sentry/types';
import EventView from 'sentry/utils/discover/eventView';
import {uniqueId} from 'sentry/utils/guid';
import {
  createDefaultRule,
  createRuleFromEventView,
  createRuleFromWizardTemplate,
  DuplicateActionFields,
  DuplicateMetricFields,
  DuplicateTriggerFields,
} from 'sentry/views/alerts/incidentRules/constants';
import {IncidentRule} from 'sentry/views/alerts/incidentRules/types';
import {WizardRuleTemplate} from 'sentry/views/alerts/wizard/options';
import AsyncView from 'sentry/views/asyncView';

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

type State = {
  defaultRule: IncidentRule;
  duplicateTargetRule?: IncidentRule;
} & AsyncView['state'];

/**
 * Show metric rules form with values from an existing rule. Redirects to alerts list after creation.
 */

class IncidentRulesDuplicate extends AsyncView<Props, State> {
  get isDuplicateRule() {
    const {
      location: {query},
      organization,
    } = this.props;
    const hasDuplicateAlertRules = organization.features.includes('duplicate-alert-rule');
    return hasDuplicateAlertRules && query.createFromDuplicate && query.duplicateRuleId;
  }

  getDefaultState() {
    const {project, eventView, wizardTemplate, userTeamIds} = this.props;
    const defaultRule = eventView
      ? createRuleFromEventView(eventView)
      : wizardTemplate
      ? createRuleFromWizardTemplate(wizardTemplate)
      : createDefaultRule();

    const projectTeamIds = new Set(project.teams.map(({id}) => id));
    const defaultOwnerId = userTeamIds.find(id => projectTeamIds.has(id)) ?? null;
    const owner = defaultOwnerId && `team:${defaultOwnerId}`;

    return {
      ...super.getDefaultState(),
      defaultRule: {
        ...defaultRule,
        owner,
        projects: [project.slug],
      },
    };
  }

  getEndpoints(): ReturnType<AsyncView['getEndpoints']> {
    const {
      params: {orgId},
      location: {query},
    } = this.props;

    if (this.isDuplicateRule) {
      return [
        [
          'duplicateTargetRule',
          `/organizations/${orgId}/alert-rules/${query.duplicateRuleId}/`,
        ],
      ];
    }

    return [];
  }

  handleSubmitSuccess = (data: any) => {
    const {
      router,
      project,
      params: {orgId},
    } = this.props;
    const alertRuleId: string | undefined = data
      ? (data.id as string | undefined)
      : undefined;

    router.push(
      alertRuleId
        ? {pathname: `/organizations/${orgId}/alerts/rules/details/${alertRuleId}/`}
        : {
            pathname: `/organizations/${orgId}/alerts/rules/`,
            query: {project: project.id},
          }
    );
  };

  renderBody() {
    const {project, sessionId, userTeamIds, ...otherProps} = this.props;
    const {defaultRule, duplicateTargetRule} = this.state;

    if (this.isDuplicateRule && !duplicateTargetRule) {
      return this.renderLoading();
    }

    const rule = duplicateTargetRule ?? defaultRule;

    return (
      <RuleForm
        onSubmitSuccess={this.handleSubmitSuccess}
        rule={
          {
            ...pick(rule, DuplicateMetricFields),
            triggers: rule.triggers.map(trigger => ({
              ...pick(trigger, DuplicateTriggerFields),
              actions: trigger.actions.map(action => ({
                inputChannelId: null,
                integrationId: undefined,
                options: null,
                sentryAppId: undefined,
                unsavedId: uniqueId(),
                unsavedDateCreated: new Date().toISOString(),
                ...pick(action, DuplicateActionFields),
              })),
            })),
            name: rule.name + ' copy',
          } as IncidentRule
        }
        sessionId={sessionId}
        project={project}
        userTeamIds={userTeamIds}
        {...otherProps}
      />
    );
  }
}

export default IncidentRulesDuplicate;
