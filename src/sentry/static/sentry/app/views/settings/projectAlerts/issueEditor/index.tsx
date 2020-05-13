import {RouteComponentProps} from 'react-router/lib/Router';
import {browserHistory} from 'react-router';
import React from 'react';
import classNames from 'classnames';
import styled from '@emotion/styled';

import {ALL_ENVIRONMENTS_KEY} from 'app/constants';
import {Environment, Organization, Project, OnboardingTaskKey} from 'app/types';
import {
  IssueAlertRule,
  IssueAlertRuleActionTemplate,
  IssueAlertRuleConditionTemplate,
  UnsavedIssueAlertRule,
} from 'app/types/alerts';
import {Panel, PanelBody, PanelHeader} from 'app/components/panels';
import {
  addErrorMessage,
  addLoadingMessage,
  addSuccessMessage,
} from 'app/actionCreators/indicator';
import {getDisplayName} from 'app/utils/environment';
import {t} from 'app/locale';
import AsyncView from 'app/views/asyncView';
import Button from 'app/components/button';
import Confirm from 'app/components/confirm';
import Form from 'app/views/settings/components/forms/form';
import LoadingMask from 'app/components/loadingMask';
import PanelAlert from 'app/components/panels/panelAlert';
import PanelItem from 'app/components/panels/panelItem';
import PanelSubHeader from 'app/views/settings/incidentRules/triggers/panelSubHeader';
import SelectField from 'app/views/settings/components/forms/selectField';
import TextField from 'app/views/settings/components/forms/textField';
import recreateRoute from 'app/utils/recreateRoute';
import space from 'app/styles/space';
import withOrganization from 'app/utils/withOrganization';
import withProject from 'app/utils/withProject';
import {updateOnboardingTask} from 'app/actionCreators/onboardingTasks';

import RuleNodeList from './ruleNodeList';

const FREQUENCY_CHOICES = [
  ['5', t('5 minutes')],
  ['10', t('10 minutes')],
  ['30', t('30 minutes')],
  ['60', t('60 minutes')],
  ['180', t('3 hours')],
  ['720', t('12 hours')],
  ['1440', t('24 hours')],
  ['10080', t('one week')],
  ['43200', t('30 days')],
];

const ACTION_MATCH_CHOICES = [
  ['all', t('all')],
  ['any', t('any')],
  ['none', t('none')],
];

const defaultRule: UnsavedIssueAlertRule = {
  actionMatch: 'all',
  actions: [],
  conditions: [],
  name: '',
  frequency: 30,
  environment: ALL_ENVIRONMENTS_KEY,
};

const POLLING_MAX_TIME_LIMIT = 3 * 60000;

// TODO(ts): I can't get this to work if I'm specific -- should be: 'condition' | 'action';
type ConditionOrAction = string;

type RuleTaskResponse = {
  status: 'pending' | 'failed' | 'success';
  rule?: IssueAlertRule;
  error?: string;
};

type Props = {
  project: Project;
  organization: Organization;
} & RouteComponentProps<{orgId: string; projectId: string; ruleId?: string}, {}>;

type State = AsyncView['state'] & {
  rule: UnsavedIssueAlertRule | IssueAlertRule;
  detailedError: null | {
    [key: string]: string[];
  };
  environments: Environment[];
  configs: {
    actions: IssueAlertRuleActionTemplate[];
    conditions: IssueAlertRuleConditionTemplate[];
  } | null;
  uuid: null | string;
};

function isSavedAlertRule(
  rule: UnsavedIssueAlertRule | IssueAlertRule
): rule is IssueAlertRule {
  return rule.hasOwnProperty('id');
}

class IssueRuleEditor extends AsyncView<Props, State> {
  getDefaultState() {
    return {
      ...super.getDefaultState(),
      configs: null,
      detailedError: null,
      rule: {...defaultRule},
      environments: [],
      uuid: null,
    };
  }

  getEndpoints() {
    const {params, location} = this.props;
    const {ruleId, projectId, orgId} = params;
    const {issue_alerts_targeting = 0} = location.query ?? {};

    const endpoints = [
      ['environments', `/projects/${orgId}/${projectId}/environments/`],
      [
        'configs',
        `/projects/${orgId}/${projectId}/rules/configuration/?issue_alerts_targeting=${issue_alerts_targeting}`,
      ],
    ];

    if (ruleId) {
      endpoints.push(['rule', `/projects/${orgId}/${projectId}/rules/${ruleId}/`]);
    }

    return endpoints as [string, string][];
  }

  pollHandler = async (quitTime: number) => {
    if (Date.now() > quitTime) {
      addErrorMessage(t('Looking for that channel took too long :('));
      this.setState({loading: false});
      return;
    }

    const {organization, project} = this.props;
    const {uuid} = this.state;
    const origRule = this.state.rule;

    try {
      const response: RuleTaskResponse = await this.api.requestPromise(
        `/projects/${organization.slug}/${project.slug}/rule-task/${uuid}/`
      );

      const {status, rule, error} = response;

      if (status === 'pending') {
        setTimeout(() => {
          this.pollHandler(quitTime);
        }, 1000);
        return;
      }

      if (status === 'failed') {
        this.setState({
          detailedError: {actions: [error ? error : t('An error occurred')]},
          loading: false,
        });
        addErrorMessage(t('An error occurred'));
      }
      if (rule) {
        const ruleId = isSavedAlertRule(origRule) ? `${origRule.id}/` : '';
        const isNew = !ruleId;
        this.handleRuleSuccess(isNew, rule);
      }
    } catch {
      addErrorMessage(t('An error occurred'));
      this.setState({loading: false});
    }
  };

  fetchStatus() {
    // pollHandler calls itself until it gets either a success
    // or failed status but we don't want to poll forever so we pass
    // in a hard stop time of 3 minutes before we bail.
    const quitTime = Date.now() + POLLING_MAX_TIME_LIMIT;
    setTimeout(() => {
      this.pollHandler(quitTime);
    }, 1000);
  }

  handleRuleSuccess = (isNew: boolean, rule: IssueAlertRule) => {
    const {organization} = this.props;
    this.setState({detailedError: null, loading: false, rule});

    // The onboarding task will be completed on the server side when the alert
    // is created
    updateOnboardingTask(null, organization, {
      task: OnboardingTaskKey.ALERT_RULE,
      status: 'complete',
    });

    // When editing, there is an extra route to move back from
    const stepBack = isNew ? -1 : -2;
    browserHistory.replace(recreateRoute('', {...this.props, stepBack}));
    addSuccessMessage(isNew ? t('Created alert rule') : t('Updated alert rule'));
  };

  handleSubmit = async () => {
    const {rule} = this.state;
    const ruleId = isSavedAlertRule(rule) ? `${rule.id}/` : '';
    const isNew = !ruleId;
    const {project, organization} = this.props;

    const endpoint = `/projects/${organization.slug}/${project.slug}/rules/${ruleId}`;

    if (rule && rule.environment === ALL_ENVIRONMENTS_KEY) {
      delete rule.environment;
    }

    addLoadingMessage();

    try {
      const [resp, , xhr] = await this.api.requestPromise(endpoint, {
        includeAllArgs: true,
        method: isNew ? 'POST' : 'PUT',
        data: rule,
      });

      // if we get a 202 back it means that we have an async task
      // running to lookup and verify the channel id for Slack.
      if (xhr && xhr.status === 202) {
        this.setState({detailedError: null, loading: true, uuid: resp.uuid});
        this.fetchStatus();
        addLoadingMessage(t('Looking through all your channels...'));
      } else {
        this.handleRuleSuccess(isNew, resp);
      }
    } catch (err) {
      this.setState({
        detailedError: err.responseJSON || {__all__: 'Unknown error'},
        loading: false,
      });
      addErrorMessage(t('An error occurred'));
    }
  };

  handleDeleteRule = async () => {
    const {rule} = this.state;
    const ruleId = isSavedAlertRule(rule) ? `${rule.id}/` : '';
    const isNew = !ruleId;
    const {project, organization} = this.props;

    if (isNew) {
      return;
    }

    const endpoint = `/projects/${organization.slug}/${project.slug}/rules/${ruleId}`;

    addLoadingMessage(t('Deleting...'));

    try {
      await this.api.requestPromise(endpoint, {
        method: 'DELETE',
      });

      addSuccessMessage(t('Deleted alert rule'));
      browserHistory.replace(recreateRoute('', {...this.props, stepBack: -2}));
    } catch (err) {
      this.setState({
        detailedError: err.responseJSON || {__all__: 'Unknown error'},
      });
      addErrorMessage(t('There was a problem deleting the alert'));
    }
  };

  handleCancel = () => {
    const {router} = this.props;

    router.push(recreateRoute('', {...this.props, stepBack: -1}));
  };

  hasError = (field: string) => {
    const {detailedError} = this.state;

    if (!detailedError) {
      return false;
    }

    return detailedError.hasOwnProperty(field);
  };

  handleEnvironmentChange = (val: string) => {
    // If 'All Environments' is selected the value should be null
    if (val === ALL_ENVIRONMENTS_KEY) {
      this.handleChange('environment', null);
    } else {
      this.handleChange('environment', val);
    }
  };

  handleChange = (prop: string, val: string | null) => {
    this.setState(state => {
      const rule = {...state.rule} as IssueAlertRule;
      rule[prop] = val;
      return {rule};
    });
  };

  handlePropertyChange = (
    type: ConditionOrAction,
    idx: number,
    prop: string,
    val: string
  ) => {
    this.setState(state => {
      const rule = {...state.rule} as IssueAlertRule;
      rule[type][idx][prop] = val;
      return {rule};
    });
  };

  handleAddRow = (type: ConditionOrAction, id: string) => {
    this.setState(state => {
      const configuration = this.state.configs?.[type]?.find(c => c.id === id);

      // Set initial configuration
      const initialValue = configuration?.formFields
        ? Object.fromEntries(
            Object.entries(configuration.formFields)
              // TODO(ts): Doesn't work if I cast formField as IssueAlertRuleFormField
              .map(([key, formField]: [string, any]) => [
                key,
                formField?.initial ?? formField?.choices?.[0]?.[0],
              ])
              .filter(([, initial]) => !!initial)
          )
        : {};
      const newRule = {
        id,
        ...initialValue,
      };

      const rule = {
        ...state.rule,
        [type]: [...(state.rule ? state.rule[type] : []), newRule],
      } as IssueAlertRule;

      return {
        rule,
      };
    });
  };

  handleDeleteRow = (type: ConditionOrAction, idx: number) => {
    this.setState(prevState => {
      const newTypeList = prevState.rule ? [...prevState.rule[type]] : [];

      if (prevState.rule) {
        newTypeList.splice(idx, 1);
      }

      const rule = {
        ...prevState.rule,
        [type]: newTypeList,
      } as IssueAlertRule;

      return {
        rule,
      };
    });
  };

  handleAddCondition = (id: string) => this.handleAddRow('conditions', id);
  handleAddAction = (id: string) => this.handleAddRow('actions', id);
  handleDeleteCondition = (ruleIndex: number) =>
    this.handleDeleteRow('conditions', ruleIndex);
  handleDeleteAction = (ruleIndex: number) => this.handleDeleteRow('actions', ruleIndex);
  handleChangeConditionProperty = (ruleIndex: number, prop: string, val: string) =>
    this.handlePropertyChange('conditions', ruleIndex, prop, val);
  handleChangeActionProperty = (ruleIndex: number, prop: string, val: string) =>
    this.handlePropertyChange('actions', ruleIndex, prop, val);

  renderLoading() {
    return this.renderBody();
  }

  renderBody() {
    const {project, organization} = this.props;
    const {environments} = this.state;
    const environmentChoices = [
      [ALL_ENVIRONMENTS_KEY, t('All Environments')],
      ...environments.map(env => [env.name, getDisplayName(env)]),
    ];

    const {rule, detailedError} = this.state;
    const {actionMatch, actions, conditions, frequency, name} = rule || {};

    const environment =
      !rule || !rule.environment ? ALL_ENVIRONMENTS_KEY : rule.environment;

    // Note `key` on `<Form>` below is so that on initial load, we show
    // the form with a loading mask on top of it, but force a re-render by using
    // a different key when we have fetched the rule so that form inputs are filled in
    return (
      <React.Fragment>
        <StyledForm
          key={isSavedAlertRule(rule) ? rule.id : undefined}
          onCancel={this.handleCancel}
          onSubmit={this.handleSubmit}
          initialData={{...rule, environment, actionMatch, frequency: `${frequency}`}}
          submitLabel={t('Save Rule')}
          extraButton={
            isSavedAlertRule(rule) ? (
              <Confirm
                priority="danger"
                confirmText={t('Delete Rule')}
                onConfirm={this.handleDeleteRule}
                header={t('Delete Rule')}
                message={t('Are you sure you want to delete this rule?')}
              >
                <Button priority="danger" type="button">
                  {t('Delete Rule')}
                </Button>
              </Confirm>
            ) : null
          }
        >
          {this.state.loading && <SemiTransparentLoadingMask />}
          <Panel>
            <PanelHeader>{t('Configure Rule Conditions')}</PanelHeader>
            <PanelBody>
              {detailedError && (
                <PanelAlert type="error">
                  {t(
                    'There was an error saving your changes. Make sure all fields are valid and try again.'
                  )}
                </PanelAlert>
              )}
              <SelectField
                className={classNames({
                  error: this.hasError('environment'),
                })}
                label={t('Environment')}
                help={t('Choose an environment for these conditions to apply to')}
                placeholder={t('Select an Environment')}
                clearable={false}
                name="environment"
                choices={environmentChoices}
                onChange={val => this.handleEnvironmentChange(val)}
              />

              <PanelSubHeader>
                {t(
                  'Whenever %s of these conditions are met for an issue',
                  <EmbeddedWrapper>
                    <EmbeddedSelectField
                      className={classNames({
                        error: this.hasError('actionMatch'),
                      })}
                      inline={false}
                      styles={{
                        control: provided => ({
                          ...provided,
                          minHeight: '20px',
                          height: '20px',
                        }),
                      }}
                      isSearchable={false}
                      isClearable={false}
                      name="actionMatch"
                      required
                      flexibleControlStateSize
                      choices={ACTION_MATCH_CHOICES}
                      onChange={val => this.handleChange('actionMatch', val)}
                    />
                  </EmbeddedWrapper>
                )}
              </PanelSubHeader>

              {this.hasError('conditions') && (
                <PanelAlert type="error">
                  {this.state.detailedError?.conditions[0]}
                </PanelAlert>
              )}

              <PanelRuleItem>
                <RuleNodeList
                  nodes={this.state.configs?.conditions ?? null}
                  items={conditions || []}
                  placeholder={t('Add a condition...')}
                  onPropertyChange={this.handleChangeConditionProperty}
                  onAddRow={this.handleAddCondition}
                  onDeleteRow={this.handleDeleteCondition}
                  organization={organization}
                  project={project}
                />
              </PanelRuleItem>

              <PanelSubHeader>{t('Perform these actions')}</PanelSubHeader>

              {this.hasError('actions') && (
                <PanelAlert type="error">
                  {this.state.detailedError?.actions[0]}
                </PanelAlert>
              )}

              <PanelRuleItem>
                <RuleNodeList
                  nodes={this.state.configs?.actions ?? null}
                  items={actions || []}
                  placeholder={t('Add an action...')}
                  onPropertyChange={this.handleChangeActionProperty}
                  onAddRow={this.handleAddAction}
                  onDeleteRow={this.handleDeleteAction}
                  organization={organization}
                  project={project}
                />
              </PanelRuleItem>
            </PanelBody>
          </Panel>

          <Panel>
            <PanelHeader>{t('Rate Limit')}</PanelHeader>
            <PanelBody>
              <SelectField
                label={t('Action Interval')}
                help={t('Perform these actions once this often for an issue')}
                clearable={false}
                name="frequency"
                className={this.hasError('frequency') ? ' error' : ''}
                value={frequency}
                required
                choices={FREQUENCY_CHOICES}
                onChange={val => this.handleChange('frequency', val)}
              />
            </PanelBody>
          </Panel>

          <Panel>
            <PanelHeader>{t('Give your rule a name')}</PanelHeader>

            {this.hasError('name') && (
              <PanelAlert type="error">{t('Must enter a rule name')}</PanelAlert>
            )}

            <PanelBody>
              <TextField
                label={t('Rule name')}
                help={t('Give your rule a name so it is easy to manage later')}
                name="name"
                defaultValue={name}
                required
                placeholder={t('My Rule Name')}
                onChange={val => this.handleChange('name', val)}
              />
            </PanelBody>
          </Panel>
        </StyledForm>
      </React.Fragment>
    );
  }
}

export default withProject(withOrganization(IssueRuleEditor));

const StyledForm = styled(Form)`
  position: relative;
`;

const PanelRuleItem = styled(PanelItem)`
  flex-direction: column;
`;

const EmbeddedWrapper = styled('div')`
  margin: 0 ${space(1)};
  width: 80px;
`;

const EmbeddedSelectField = styled(SelectField)`
  padding: 0;
  font-weight: normal;
  text-transform: none;
`;

const SemiTransparentLoadingMask = styled(LoadingMask)`
  opacity: 0.6;
  z-index: 1; /* Needed so that it sits above form elements */
`;
