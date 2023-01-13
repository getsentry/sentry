import type {RouteComponentProps} from 'react-router';
import pick from 'lodash/pick';

import * as Layout from 'sentry/components/layouts/thirds';
import type {Organization, Project} from 'sentry/types';
import type EventView from 'sentry/utils/discover/eventView';
import {uniqueId} from 'sentry/utils/guid';
import {normalizeUrl} from 'sentry/utils/withDomainRequired';
import {
  DuplicateActionFields,
  DuplicateMetricFields,
  DuplicateTriggerFields,
} from 'sentry/views/alerts/rules/metric/constants';
import type {MetricRule} from 'sentry/views/alerts/rules/metric/types';
import type {WizardRuleTemplate} from 'sentry/views/alerts/wizard/options';
import AsyncView from 'sentry/views/asyncView';

import RuleForm from './ruleForm';

type Props = {
  organization: Organization;
  project: Project;
  userTeamIds: string[];
  eventView?: EventView;
  sessionId?: string;
  wizardTemplate?: WizardRuleTemplate;
} & RouteComponentProps<{}, {}>;

type State = {
  duplicateTargetRule?: MetricRule;
} & AsyncView['state'];

/**
 * Show metric rules form with values from an existing rule. Redirects to alerts list after creation.
 */

class MetricRulesDuplicate extends AsyncView<Props, State> {
  getEndpoints(): ReturnType<AsyncView['getEndpoints']> {
    const {
      organization,
      location: {query},
    } = this.props;

    return [
      [
        'duplicateTargetRule',
        `/organizations/${organization.slug}/alert-rules/${query.duplicateRuleId}/`,
      ],
    ];
  }

  handleSubmitSuccess = (data: any) => {
    const {router, organization, project} = this.props;
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
    router.push(normalizeUrl(target));
  };

  renderBody() {
    const {project, sessionId, userTeamIds, ...otherProps} = this.props;
    const {duplicateTargetRule} = this.state;

    if (!duplicateTargetRule) {
      return this.renderLoading();
    }

    return (
      <Layout.Main>
        <RuleForm
          onSubmitSuccess={this.handleSubmitSuccess}
          rule={
            {
              ...pick(duplicateTargetRule, DuplicateMetricFields),
              triggers: duplicateTargetRule.triggers.map(trigger => ({
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
}

export default MetricRulesDuplicate;
