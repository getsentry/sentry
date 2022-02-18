import * as React from 'react';
import {browserHistory, RouteComponentProps} from 'react-router';
import styled from '@emotion/styled';
import classNames from 'classnames';
import cloneDeep from 'lodash/cloneDeep';
import omit from 'lodash/omit';
import set from 'lodash/set';

import {
  addErrorMessage,
  addLoadingMessage,
  addSuccessMessage,
} from 'sentry/actionCreators/indicator';
import {updateOnboardingTask} from 'sentry/actionCreators/onboardingTasks';
import Access from 'sentry/components/acl/access';
import Feature from 'sentry/components/acl/feature';
import Alert from 'sentry/components/alert';
import Button from 'sentry/components/button';
import Confirm from 'sentry/components/confirm';
import Input from 'sentry/components/forms/controls/input';
import Field from 'sentry/components/forms/field';
import Form from 'sentry/components/forms/form';
import SelectField from 'sentry/components/forms/selectField';
import TeamSelector from 'sentry/components/forms/teamSelector';
import List from 'sentry/components/list';
import ListItem from 'sentry/components/list/listItem';
import LoadingMask from 'sentry/components/loadingMask';
import {Panel, PanelBody} from 'sentry/components/panels';
import {ALL_ENVIRONMENTS_KEY} from 'sentry/constants';
import {IconChevron, IconWarning} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import space from 'sentry/styles/space';
import {Environment, OnboardingTaskKey, Organization, Project, Team} from 'sentry/types';
import {
  IssueAlertRule,
  IssueAlertRuleAction,
  IssueAlertRuleActionTemplate,
  IssueAlertRuleConditionTemplate,
  UnsavedIssueAlertRule,
} from 'sentry/types/alerts';
import {metric} from 'sentry/utils/analytics';
import trackAdvancedAnalyticsEvent from 'sentry/utils/analytics/trackAdvancedAnalyticsEvent';
import {getDisplayName} from 'sentry/utils/environment';
import {isActiveSuperuser} from 'sentry/utils/isActiveSuperuser';
import recreateRoute from 'sentry/utils/recreateRoute';
import routeTitleGen from 'sentry/utils/routeTitle';
import withOrganization from 'sentry/utils/withOrganization';
import {
  CHANGE_ALERT_CONDITION_IDS,
  CHANGE_ALERT_PLACEHOLDERS_LABELS,
} from 'sentry/views/alerts/changeAlerts/constants';
import AsyncView from 'sentry/views/asyncView';

import RuleNodeList from './ruleNodeList';
import SetupAlertIntegrationButton from './setupAlertIntegrationButton';

const FREQUENCY_OPTIONS = [
  {value: '5', label: t('5 minutes')},
  {value: '10', label: t('10 minutes')},
  {value: '30', label: t('30 minutes')},
  {value: '60', label: t('60 minutes')},
  {value: '180', label: t('3 hours')},
  {value: '720', label: t('12 hours')},
  {value: '1440', label: t('24 hours')},
  {value: '10080', label: t('1 week')},
  {value: '43200', label: t('30 days')},
];

const ACTION_MATCH_OPTIONS = [
  {value: 'all', label: t('all')},
  {value: 'any', label: t('any')},
  {value: 'none', label: t('none')},
];

const ACTION_MATCH_OPTIONS_MIGRATED = [
  {value: 'all', label: t('all')},
  {value: 'any', label: t('any')},
];

const defaultRule: UnsavedIssueAlertRule = {
  actionMatch: 'all',
  filterMatch: 'all',
  actions: [],
  conditions: [],
  filters: [],
  name: '',
  frequency: 30,
  environment: ALL_ENVIRONMENTS_KEY,
};

const POLLING_MAX_TIME_LIMIT = 3 * 60000;

type ConditionOrActionProperty = 'conditions' | 'actions' | 'filters';

type RuleTaskResponse = {
  status: 'pending' | 'failed' | 'success';
  error?: string;
  rule?: IssueAlertRule;
};

type Props = {
  organization: Organization;
  project: Project;
  userTeamIds: string[];
  onChangeTitle?: (data: string) => void;
} & RouteComponentProps<{orgId: string; projectId: string; ruleId?: string}, {}>;

type State = AsyncView['state'] & {
  configs: {
    actions: IssueAlertRuleActionTemplate[];
    conditions: IssueAlertRuleConditionTemplate[];
    filters: IssueAlertRuleConditionTemplate[];
  } | null;
  detailedError: null | {
    [key: string]: string[];
  };
  environments: Environment[] | null;
  uuid: null | string;
  rule?: UnsavedIssueAlertRule | IssueAlertRule | null;
};

function isSavedAlertRule(rule: State['rule']): rule is IssueAlertRule {
  return rule?.hasOwnProperty('id') ?? false;
}

class IssueRuleEditor extends AsyncView<Props, State> {
  getTitle() {
    const {organization, project} = this.props;
    const {rule} = this.state;
    const ruleName = rule?.name;

    return routeTitleGen(
      ruleName ? t('Alert %s', ruleName) : '',
      organization.slug,
      false,
      project?.slug
    );
  }

  getDefaultState() {
    const {userTeamIds, project} = this.props;
    const defaultState = {
      ...super.getDefaultState(),
      configs: null,
      detailedError: null,
      rule: {...defaultRule},
      environments: [],
      uuid: null,
    };

    const projectTeamIds = new Set(project.teams.map(({id}) => id));
    const userTeamId = userTeamIds.find(id => projectTeamIds.has(id)) ?? null;
    defaultState.rule.owner = userTeamId && `team:${userTeamId}`;

    return defaultState;
  }

  getEndpoints(): ReturnType<AsyncView['getEndpoints']> {
    const {ruleId, projectId, orgId} = this.props.params;

    const endpoints = [
      ['environments', `/projects/${orgId}/${projectId}/environments/`],
      ['configs', `/projects/${orgId}/${projectId}/rules/configuration/`],
    ];

    if (ruleId) {
      endpoints.push(['rule', `/projects/${orgId}/${projectId}/rules/${ruleId}/`]);
    }

    return endpoints as [string, string][];
  }

  onRequestSuccess({stateKey, data}) {
    if (stateKey === 'rule' && data.name) {
      this.props.onChangeTitle?.(data.name);
    }
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
        this.handleRuleSaveFailure(t('An error occurred'));
      }
      if (rule) {
        const ruleId = isSavedAlertRule(origRule) ? `${origRule.id}/` : '';
        const isNew = !ruleId;
        this.handleRuleSuccess(isNew, rule);
      }
    } catch {
      this.handleRuleSaveFailure(t('An error occurred'));
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
    const {organization, project, router} = this.props;
    this.setState({detailedError: null, loading: false, rule});

    // The onboarding task will be completed on the server side when the alert
    // is created
    updateOnboardingTask(null, organization, {
      task: OnboardingTaskKey.ALERT_RULE,
      status: 'complete',
    });

    metric.endTransaction({name: 'saveAlertRule'});

    router.push({
      pathname: `/organizations/${organization.slug}/alerts/rules/`,
      query: {project: project.id},
    });
    addSuccessMessage(isNew ? t('Created alert rule') : t('Updated alert rule'));
  };

  handleRuleSaveFailure(msg: React.ReactNode) {
    addErrorMessage(msg);
    metric.endTransaction({name: 'saveAlertRule'});
  }

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
      const transaction = metric.startTransaction({name: 'saveAlertRule'});
      transaction.setTag('type', 'issue');
      transaction.setTag('operation', isNew ? 'create' : 'edit');
      if (rule) {
        for (const action of rule.actions) {
          // Grab the last part of something like 'sentry.mail.actions.NotifyEmailAction'
          const splitActionId = action.id.split('.');
          const actionName = splitActionId[splitActionId.length - 1];
          if (actionName === 'SlackNotifyServiceAction') {
            transaction.setTag(actionName, true);
          }
        }
        transaction.setData('actions', rule.actions);
      }
      const [data, , resp] = await this.api.requestPromise(endpoint, {
        includeAllArgs: true,
        method: isNew ? 'POST' : 'PUT',
        data: rule,
      });

      // if we get a 202 back it means that we have an async task
      // running to lookup and verify the channel id for Slack.
      if (resp?.status === 202) {
        this.setState({detailedError: null, loading: true, uuid: data.uuid});
        this.fetchStatus();
        addLoadingMessage(t('Looking through all your channels...'));
      } else {
        this.handleRuleSuccess(isNew, data);
      }
    } catch (err) {
      this.setState({
        detailedError: err.responseJSON || {__all__: 'Unknown error'},
        loading: false,
      });
      this.handleRuleSaveFailure(t('An error occurred'));
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
    const {organization, router} = this.props;

    router.push(`/organizations/${organization.slug}/alerts/rules/`);
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

  handleChange = <T extends keyof IssueAlertRule>(prop: T, val: IssueAlertRule[T]) => {
    this.setState(prevState => {
      const clonedState = cloneDeep(prevState);
      set(clonedState, `rule[${prop}]`, val);
      return {...clonedState, detailedError: omit(prevState.detailedError, prop)};
    });
  };

  handlePropertyChange = <T extends keyof IssueAlertRuleAction>(
    type: ConditionOrActionProperty,
    idx: number,
    prop: T,
    val: IssueAlertRuleAction[T]
  ) => {
    this.setState(prevState => {
      const clonedState = cloneDeep(prevState);
      set(clonedState, `rule[${type}][${idx}][${prop}]`, val);
      return clonedState;
    });
  };

  getInitialValue = (type: ConditionOrActionProperty, id: string) => {
    const configuration = this.state.configs?.[type]?.find(c => c.id === id);

    const hasChangeAlerts =
      configuration?.id &&
      this.props.organization.features.includes('change-alerts') &&
      CHANGE_ALERT_CONDITION_IDS.includes(configuration.id);

    return configuration?.formFields
      ? Object.fromEntries(
          Object.entries(configuration.formFields)
            // TODO(ts): Doesn't work if I cast formField as IssueAlertRuleFormField
            .map(([key, formField]: [string, any]) => [
              key,
              hasChangeAlerts && key === 'interval'
                ? '1h'
                : formField?.initial ?? formField?.choices?.[0]?.[0],
            ])
            .filter(([, initial]) => !!initial)
        )
      : {};
  };

  handleResetRow = <T extends keyof IssueAlertRuleAction>(
    type: ConditionOrActionProperty,
    idx: number,
    prop: T,
    val: IssueAlertRuleAction[T]
  ) => {
    this.setState(prevState => {
      const clonedState = cloneDeep(prevState);

      // Set initial configuration, but also set
      const id = (clonedState.rule as IssueAlertRule)[type][idx].id;
      const newRule = {
        ...this.getInitialValue(type, id),
        id,
        [prop]: val,
      };

      set(clonedState, `rule[${type}][${idx}]`, newRule);
      return clonedState;
    });
  };

  handleAddRow = (type: ConditionOrActionProperty, id: string) => {
    this.setState(prevState => {
      const clonedState = cloneDeep(prevState);

      // Set initial configuration
      const newRule = {
        ...this.getInitialValue(type, id),
        id,
      };
      const newTypeList = prevState.rule ? prevState.rule[type] : [];

      set(clonedState, `rule[${type}]`, [...newTypeList, newRule]);
      return clonedState;
    });

    const {organization, project} = this.props;
    trackAdvancedAnalyticsEvent('edit_alert_rule.add_row', {
      organization,
      project_id: project.id,
      type,
      name: id,
    });
  };

  handleDeleteRow = (type: ConditionOrActionProperty, idx: number) => {
    this.setState(prevState => {
      const clonedState = cloneDeep(prevState);

      const newTypeList = prevState.rule ? prevState.rule[type] : [];
      if (prevState.rule) {
        newTypeList.splice(idx, 1);
      }

      set(clonedState, `rule[${type}]`, newTypeList);
      return clonedState;
    });
  };

  handleAddCondition = (id: string) => this.handleAddRow('conditions', id);
  handleAddAction = (id: string) => this.handleAddRow('actions', id);
  handleAddFilter = (id: string) => this.handleAddRow('filters', id);
  handleDeleteCondition = (ruleIndex: number) =>
    this.handleDeleteRow('conditions', ruleIndex);
  handleDeleteAction = (ruleIndex: number) => this.handleDeleteRow('actions', ruleIndex);
  handleDeleteFilter = (ruleIndex: number) => this.handleDeleteRow('filters', ruleIndex);
  handleChangeConditionProperty = (ruleIndex: number, prop: string, val: string) =>
    this.handlePropertyChange('conditions', ruleIndex, prop, val);
  handleChangeActionProperty = (ruleIndex: number, prop: string, val: string) =>
    this.handlePropertyChange('actions', ruleIndex, prop, val);
  handleChangeFilterProperty = (ruleIndex: number, prop: string, val: string) =>
    this.handlePropertyChange('filters', ruleIndex, prop, val);
  handleResetCondition = (ruleIndex: number, prop: string, value: string) =>
    this.handleResetRow('conditions', ruleIndex, prop, value);
  handleResetAction = (ruleIndex: number, prop: string, value: string) =>
    this.handleResetRow('actions', ruleIndex, prop, value);
  handleResetFilter = (ruleIndex: number, prop: string, value: string) =>
    this.handleResetRow('filters', ruleIndex, prop, value);

  handleValidateRuleName = () => {
    const isRuleNameEmpty = !this.state.rule?.name.trim();

    if (!isRuleNameEmpty) {
      return;
    }

    this.setState(prevState => ({
      detailedError: {
        ...prevState.detailedError,
        name: [t('Field Required')],
      },
    }));
  };

  getConditions() {
    const {organization} = this.props;

    if (!organization.features.includes('change-alerts')) {
      return this.state.configs?.conditions ?? null;
    }

    return (
      this.state.configs?.conditions?.map(condition =>
        CHANGE_ALERT_CONDITION_IDS.includes(condition.id)
          ? ({
              ...condition,
              label: CHANGE_ALERT_PLACEHOLDERS_LABELS[condition.id],
            } as IssueAlertRuleConditionTemplate)
          : condition
      ) ?? null
    );
  }

  getTeamId = () => {
    const {rule} = this.state;
    const owner = rule?.owner;
    // ownership follows the format team:<id>, just grab the id
    return owner && owner.split(':')[1];
  };

  handleOwnerChange = ({value}: {label: string; value: string}) => {
    const ownerValue = value && `team:${value}`;
    this.handleChange('owner', ownerValue);
  };

  renderLoading() {
    return this.renderBody();
  }

  renderError() {
    return (
      <Alert type="error" icon={<IconWarning />}>
        {t(
          'Unable to access this alert rule -- check to make sure you have the correct permissions'
        )}
      </Alert>
    );
  }

  renderBody() {
    const {project, organization, userTeamIds} = this.props;
    const {environments} = this.state;
    const environmentOptions = [
      {
        value: ALL_ENVIRONMENTS_KEY,
        label: t('All Environments'),
      },
      ...(environments?.map(env => ({value: env.name, label: getDisplayName(env)})) ??
        []),
    ];

    const {rule, detailedError} = this.state;
    const {actions, filters, conditions, frequency, name} = rule || {};

    const environment =
      !rule || !rule.environment ? ALL_ENVIRONMENTS_KEY : rule.environment;

    const ownerId = rule?.owner?.split(':')[1];
    // check if superuser or if user is on the alert's team
    const canEdit =
      isActiveSuperuser() || (ownerId ? userTeamIds.includes(ownerId) : true);

    // Note `key` on `<Form>` below is so that on initial load, we show
    // the form with a loading mask on top of it, but force a re-render by using
    // a different key when we have fetched the rule so that form inputs are filled in
    return (
      <Access access={['alerts:write']}>
        {({hasAccess}) => (
          <StyledForm
            key={isSavedAlertRule(rule) ? rule.id : undefined}
            onCancel={this.handleCancel}
            onSubmit={this.handleSubmit}
            initialData={{
              ...rule,
              environment,
              frequency: `${frequency}`,
            }}
            submitDisabled={!hasAccess || !canEdit}
            submitLabel={t('Save Rule')}
            extraButton={
              isSavedAlertRule(rule) ? (
                <Confirm
                  disabled={!hasAccess || !canEdit}
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
            <List symbol="colored-numeric">
              {this.state.loading && <SemiTransparentLoadingMask />}
              <StyledListItem>{t('Add alert settings')}</StyledListItem>
              <Panel>
                <PanelBody>
                  <SelectField
                    className={classNames({
                      error: this.hasError('environment'),
                    })}
                    label={t('Environment')}
                    help={t('Choose an environment for these conditions to apply to')}
                    placeholder={t('Select an Environment')}
                    clearable={false}
                    name="environment"
                    options={environmentOptions}
                    onChange={val => this.handleEnvironmentChange(val)}
                    disabled={!hasAccess || !canEdit}
                  />

                  <StyledField
                    label={t('Team')}
                    help={t('The team that can edit this alert.')}
                    disabled={!hasAccess || !canEdit}
                  >
                    <TeamSelector
                      value={this.getTeamId()}
                      project={project}
                      onChange={this.handleOwnerChange}
                      teamFilter={(team: Team) => team.isMember || team.id === ownerId}
                      useId
                      includeUnassigned
                      disabled={!hasAccess || !canEdit}
                    />
                  </StyledField>

                  <StyledField
                    label={t('Alert name')}
                    help={t('Add a name for this alert')}
                    error={detailedError?.name?.[0]}
                    disabled={!hasAccess || !canEdit}
                    required
                    stacked
                  >
                    <Input
                      type="text"
                      name="name"
                      value={name}
                      placeholder={t('My Rule Name')}
                      onChange={(event: React.ChangeEvent<HTMLInputElement>) =>
                        this.handleChange('name', event.target.value)
                      }
                      onBlur={this.handleValidateRuleName}
                      disabled={!hasAccess || !canEdit}
                    />
                  </StyledField>
                </PanelBody>
              </Panel>
              <SetConditionsListItem>
                {t('Set conditions')}
                <SetupAlertIntegrationButton
                  projectSlug={project.slug}
                  organization={organization}
                />
              </SetConditionsListItem>
              <ConditionsPanel>
                <PanelBody>
                  <Step>
                    <StepConnector />

                    <StepContainer>
                      <ChevronContainer>
                        <IconChevron
                          color="gray200"
                          isCircled
                          direction="right"
                          size="sm"
                        />
                      </ChevronContainer>

                      <Feature features={['projects:alert-filters']} project={project}>
                        {({hasFeature}) => (
                          <StepContent>
                            <StepLead>
                              {tct(
                                '[when:When] an event is captured by Sentry and [selector] of the following happens',
                                {
                                  when: <Badge />,
                                  selector: (
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
                                        options={
                                          hasFeature
                                            ? ACTION_MATCH_OPTIONS_MIGRATED
                                            : ACTION_MATCH_OPTIONS
                                        }
                                        onChange={val =>
                                          this.handleChange('actionMatch', val)
                                        }
                                        disabled={!hasAccess || !canEdit}
                                      />
                                    </EmbeddedWrapper>
                                  ),
                                }
                              )}
                            </StepLead>
                            <RuleNodeList
                              nodes={this.getConditions()}
                              items={conditions ?? []}
                              selectType="grouped"
                              placeholder={
                                hasFeature
                                  ? t('Add optional trigger...')
                                  : t('Add optional condition...')
                              }
                              onPropertyChange={this.handleChangeConditionProperty}
                              onAddRow={this.handleAddCondition}
                              onResetRow={this.handleResetCondition}
                              onDeleteRow={this.handleDeleteCondition}
                              organization={organization}
                              project={project}
                              disabled={!hasAccess || !canEdit}
                              error={
                                this.hasError('conditions') && (
                                  <StyledAlert type="error">
                                    {detailedError?.conditions[0]}
                                  </StyledAlert>
                                )
                              }
                            />
                          </StepContent>
                        )}
                      </Feature>
                    </StepContainer>
                  </Step>

                  <Feature
                    features={['organizations:alert-filters', 'projects:alert-filters']}
                    organization={organization}
                    project={project}
                    requireAll={false}
                  >
                    <Step>
                      <StepConnector />

                      <StepContainer>
                        <ChevronContainer>
                          <IconChevron
                            color="gray200"
                            isCircled
                            direction="right"
                            size="sm"
                          />
                        </ChevronContainer>

                        <StepContent>
                          <StepLead>
                            {tct('[if:If] [selector] of these filters match', {
                              if: <Badge />,
                              selector: (
                                <EmbeddedWrapper>
                                  <EmbeddedSelectField
                                    className={classNames({
                                      error: this.hasError('filterMatch'),
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
                                    name="filterMatch"
                                    required
                                    flexibleControlStateSize
                                    options={ACTION_MATCH_OPTIONS}
                                    onChange={val =>
                                      this.handleChange('filterMatch', val)
                                    }
                                    disabled={!hasAccess || !canEdit}
                                  />
                                </EmbeddedWrapper>
                              ),
                            })}
                          </StepLead>
                          <RuleNodeList
                            nodes={this.state.configs?.filters ?? null}
                            items={filters ?? []}
                            placeholder={t('Add optional filter...')}
                            onPropertyChange={this.handleChangeFilterProperty}
                            onAddRow={this.handleAddFilter}
                            onResetRow={this.handleResetFilter}
                            onDeleteRow={this.handleDeleteFilter}
                            organization={organization}
                            project={project}
                            disabled={!hasAccess || !canEdit}
                            error={
                              this.hasError('filters') && (
                                <StyledAlert type="error">
                                  {detailedError?.filters[0]}
                                </StyledAlert>
                              )
                            }
                          />
                        </StepContent>
                      </StepContainer>
                    </Step>
                  </Feature>

                  <Step>
                    <StepContainer>
                      <ChevronContainer>
                        <IconChevron
                          isCircled
                          color="gray200"
                          direction="right"
                          size="sm"
                        />
                      </ChevronContainer>
                      <StepContent>
                        <StepLead>
                          {tct('[then:Then] perform these actions', {
                            then: <Badge />,
                          })}
                        </StepLead>

                        <RuleNodeList
                          nodes={this.state.configs?.actions ?? null}
                          selectType="grouped"
                          items={actions ?? []}
                          placeholder={t('Add action...')}
                          onPropertyChange={this.handleChangeActionProperty}
                          onAddRow={this.handleAddAction}
                          onResetRow={this.handleResetAction}
                          onDeleteRow={this.handleDeleteAction}
                          organization={organization}
                          project={project}
                          disabled={!hasAccess || !canEdit}
                          error={
                            this.hasError('actions') && (
                              <StyledAlert type="error">
                                {detailedError?.actions[0]}
                              </StyledAlert>
                            )
                          }
                        />
                      </StepContent>
                    </StepContainer>
                  </Step>
                </PanelBody>
              </ConditionsPanel>
              <StyledListItem>{t('Set action interval')}</StyledListItem>
              <Panel>
                <PanelBody>
                  <SelectField
                    label={t('Action Interval')}
                    help={t('Perform these actions once this often for an issue')}
                    clearable={false}
                    name="frequency"
                    className={this.hasError('frequency') ? ' error' : ''}
                    value={frequency}
                    required
                    options={FREQUENCY_OPTIONS}
                    onChange={val => this.handleChange('frequency', val)}
                    disabled={!hasAccess || !canEdit}
                  />
                </PanelBody>
              </Panel>
            </List>
          </StyledForm>
        )}
      </Access>
    );
  }
}

export default withOrganization(IssueRuleEditor);

// TODO(ts): Understand why styled is not correctly inheriting props here
const StyledForm = styled(Form)<Form['props']>`
  position: relative;
`;

const ConditionsPanel = styled(Panel)`
  padding-top: ${space(0.5)};
  padding-bottom: ${space(2)};
`;

const StyledAlert = styled(Alert)`
  margin-bottom: 0;
`;

const StyledListItem = styled(ListItem)`
  margin: ${space(2)} 0 ${space(1)} 0;
  font-size: ${p => p.theme.fontSizeExtraLarge};
`;

const SetConditionsListItem = styled(StyledListItem)`
  display: flex;
  justify-content: space-between;
`;

const Step = styled('div')`
  position: relative;
  display: flex;
  align-items: flex-start;
  margin: ${space(4)} ${space(4)} ${space(3)} ${space(1)};
`;

const StepContainer = styled('div')`
  position: relative;
  display: flex;
  align-items: flex-start;
  flex-grow: 1;
`;

const StepContent = styled('div')`
  flex-grow: 1;
`;

const StepConnector = styled('div')`
  position: absolute;
  height: 100%;
  top: 28px;
  left: 19px;
  border-right: 1px ${p => p.theme.gray200} dashed;
`;

const StepLead = styled('div')`
  margin-bottom: ${space(0.5)};
`;

const ChevronContainer = styled('div')`
  display: flex;
  align-items: center;
  padding: ${space(0.5)} ${space(1.5)};
`;

const Badge = styled('span')`
  display: inline-block;
  min-width: 56px;
  background-color: ${p => p.theme.purple300};
  padding: 0 ${space(0.75)};
  border-radius: ${p => p.theme.borderRadius};
  color: ${p => p.theme.white};
  text-transform: uppercase;
  text-align: center;
  font-size: ${p => p.theme.fontSizeMedium};
  font-weight: 600;
  line-height: 1.5;
`;

const EmbeddedWrapper = styled('div')`
  display: inline-block;
  margin: 0 ${space(0.5)};
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

const StyledField = styled(Field)`
  :last-child {
    padding-bottom: ${space(2)};
  }
`;
