import type {ChangeEvent, ReactNode} from 'react';
import {Fragment} from 'react';
import styled from '@emotion/styled';
import * as Sentry from '@sentry/react';
import classNames from 'classnames';
import type {Location} from 'history';
import cloneDeep from 'lodash/cloneDeep';
import debounce from 'lodash/debounce';
import omit from 'lodash/omit';
import set from 'lodash/set';

import {
  addErrorMessage,
  addLoadingMessage,
  addSuccessMessage,
} from 'sentry/actionCreators/indicator';
import {updateOnboardingTask} from 'sentry/actionCreators/onboardingTasks';
import {hasEveryAccess} from 'sentry/components/acl/access';
import {Alert} from 'sentry/components/alert';
import AlertLink from 'sentry/components/alertLink';
import {Button} from 'sentry/components/button';
import Checkbox from 'sentry/components/checkbox';
import Confirm from 'sentry/components/confirm';
import DeprecatedAsyncComponent from 'sentry/components/deprecatedAsyncComponent';
import ErrorBoundary from 'sentry/components/errorBoundary';
import {components} from 'sentry/components/forms/controls/reactSelectWrapper';
import SelectControl from 'sentry/components/forms/controls/selectControl';
import FieldGroup from 'sentry/components/forms/fieldGroup';
import FieldHelp from 'sentry/components/forms/fieldGroup/fieldHelp';
import SelectField from 'sentry/components/forms/fields/selectField';
import type {FormProps} from 'sentry/components/forms/form';
import Form from 'sentry/components/forms/form';
import FormField from 'sentry/components/forms/formField';
import IdBadge from 'sentry/components/idBadge';
import Input from 'sentry/components/input';
import * as Layout from 'sentry/components/layouts/thirds';
import ExternalLink from 'sentry/components/links/externalLink';
import List from 'sentry/components/list';
import ListItem from 'sentry/components/list/listItem';
import LoadingMask from 'sentry/components/loadingMask';
import Panel from 'sentry/components/panels/panel';
import PanelBody from 'sentry/components/panels/panelBody';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import TeamSelector from 'sentry/components/teamSelector';
import {ALL_ENVIRONMENTS_KEY} from 'sentry/constants';
import {IconChevron, IconNot} from 'sentry/icons';
import {t, tct, tn} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {
  IssueAlertConfiguration,
  IssueAlertRule,
  IssueAlertRuleAction,
  IssueAlertRuleActionTemplate,
  UnsavedIssueAlertRule,
} from 'sentry/types/alerts';
import {
  IssueAlertActionType,
  IssueAlertConditionType,
  IssueAlertFilterType,
} from 'sentry/types/alerts';
import type {RouteComponentProps} from 'sentry/types/legacyReactRouter';
import {OnboardingTaskKey} from 'sentry/types/onboarding';
import type {Member, Organization, Team} from 'sentry/types/organization';
import type {Environment, Project} from 'sentry/types/project';
import {metric, trackAnalytics} from 'sentry/utils/analytics';
import {browserHistory} from 'sentry/utils/browserHistory';
import {getDisplayName} from 'sentry/utils/environment';
import {isActiveSuperuser} from 'sentry/utils/isActiveSuperuser';
import recreateRoute from 'sentry/utils/recreateRoute';
import normalizeUrl from 'sentry/utils/url/normalizeUrl';
import withOrganization from 'sentry/utils/withOrganization';
import withProjects from 'sentry/utils/withProjects';
import {makeAlertsPathname} from 'sentry/views/alerts/pathnames';
import FeedbackAlertBanner from 'sentry/views/alerts/rules/issue/feedbackAlertBanner';
import {PreviewIssues} from 'sentry/views/alerts/rules/issue/previewIssues';
import SetupMessagingIntegrationButton, {
  MessagingIntegrationAnalyticsView,
} from 'sentry/views/alerts/rules/issue/setupMessagingIntegrationButton';
import {
  CHANGE_ALERT_CONDITION_IDS,
  CHANGE_ALERT_PLACEHOLDERS_LABELS,
} from 'sentry/views/alerts/utils/constants';
import {ProjectPermissionAlert} from 'sentry/views/settings/project/projectPermissionAlert';

import {getProjectOptions} from '../utils';

import RuleNodeList from './ruleNodeList';

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
  actionMatch: 'any',
  filterMatch: 'all',
  actions: [],
  // note we update the default conditions in onLoadAllEndpointsSuccess
  conditions: [],
  filters: [],
  name: '',
  frequency: 60 * 24,
  environment: ALL_ENVIRONMENTS_KEY,
};

const POLLING_MAX_TIME_LIMIT = 3 * 60000;

type ConfigurationKey = keyof IssueAlertConfiguration;

type RuleTaskResponse = {
  status: 'pending' | 'failed' | 'success';
  error?: string;
  rule?: IssueAlertRule;
};

type RouteParams = {projectId?: string; ruleId?: string};

export type IncompatibleRule = {
  conditionIndices: number[] | null;
  filterIndices: number[] | null;
};

type Props = {
  location: Location;
  members: Member[] | undefined;
  organization: Organization;
  project: Project;
  projects: Project[];
  userTeamIds: string[];
  loadingProjects?: boolean;
  onChangeTitle?: (data: string) => void;
} & RouteComponentProps<RouteParams, {}>;

type State = DeprecatedAsyncComponent['state'] & {
  configs: IssueAlertConfiguration | null;
  detailedError: null | {
    [key: string]: string[];
  };
  environments: Environment[] | null;
  incompatibleConditions: number[] | null;
  incompatibleFilters: number[] | null;
  project: Project;
  sendingNotification: boolean;
  acceptedNoisyAlert?: boolean;
  duplicateTargetRule?: UnsavedIssueAlertRule | IssueAlertRule | null;
  rule?: UnsavedIssueAlertRule | IssueAlertRule | null;
};

function isSavedAlertRule(rule: State['rule']): rule is IssueAlertRule {
  return rule?.hasOwnProperty('id') ?? false;
}

/**
 * Expecting "This rule is an exact duplicate of '{duplicate_rule.label}' in this project and may not be created."
 */
const isExactDuplicateExp = /duplicate of '(.*)'/;

class IssueRuleEditor extends DeprecatedAsyncComponent<Props, State> {
  pollingTimeout: number | undefined = undefined;
  trackIncompatibleAnalytics = false;
  trackNoisyWarningViewed = false;
  isUnmounted = false;
  uuid: string | null = null;

  get isDuplicateRule(): boolean {
    const {location} = this.props;
    const createFromDuplicate = location?.query.createFromDuplicate === 'true';
    return createFromDuplicate && location?.query.duplicateRuleId;
  }

  componentDidMount() {
    super.componentDidMount();
  }

  componentWillUnmount() {
    super.componentWillUnmount();
    this.isUnmounted = true;
    window.clearTimeout(this.pollingTimeout);
    this.checkIncompatibleRuleDebounced.cancel();
  }

  componentDidUpdate(_prevProps: Props, prevState: State) {
    if (this.isRuleStateChange(prevState)) {
      this.setState({
        incompatibleConditions: null,
        incompatibleFilters: null,
      });
      this.checkIncompatibleRuleDebounced();
    }
    if (prevState.project.id === this.state.project.id) {
      return;
    }

    this.fetchEnvironments();
    this.refetchConfigs();
  }

  isRuleStateChange(prevState: State): boolean {
    const prevRule = prevState.rule;
    const curRule = this.state.rule;
    return (
      JSON.stringify(prevRule?.conditions) !== JSON.stringify(curRule?.conditions) ||
      JSON.stringify(prevRule?.filters) !== JSON.stringify(curRule?.filters) ||
      prevRule?.actionMatch !== curRule?.actionMatch ||
      prevRule?.filterMatch !== curRule?.filterMatch ||
      prevRule?.frequency !== curRule?.frequency ||
      JSON.stringify(prevState.project) !== JSON.stringify(this.state.project)
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
      project,
      sendingNotification: false,
      incompatibleConditions: null,
      incompatibleFilters: null,
    };

    const projectTeamIds = new Set(project.teams.map(({id}) => id));
    const userTeamId = userTeamIds.find(id => projectTeamIds.has(id)) ?? null;
    defaultState.rule.owner = userTeamId && `team:${userTeamId}`;

    return defaultState;
  }

  getEndpoints(): ReturnType<DeprecatedAsyncComponent['getEndpoints']> {
    const {
      location: {query},
      params: {ruleId},
    } = this.props;
    const {organization} = this.props;
    // project in state isn't initialized when getEndpoints is first called
    const project = this.state?.project ?? this.props.project;

    const endpoints = [
      [
        'environments',
        `/projects/${organization.slug}/${project.slug}/environments/`,
        {
          query: {
            visibility: 'visible',
          },
        },
      ],
      ['configs', `/projects/${organization.slug}/${project.slug}/rules/configuration/`],
    ];

    if (ruleId) {
      endpoints.push([
        'rule',
        `/projects/${organization.slug}/${project.slug}/rules/${ruleId}/`,
      ]);
    }

    if (!ruleId && query.createFromDuplicate && query.duplicateRuleId) {
      endpoints.push([
        'duplicateTargetRule',
        `/projects/${organization.slug}/${project.slug}/rules/${query.duplicateRuleId}/`,
      ]);
    }

    return endpoints as Array<[string, string]>;
  }

  onRequestSuccess({stateKey, data}: any) {
    if (stateKey === 'rule' && data.name) {
      this.props.onChangeTitle?.(data.name);
    }
    if (stateKey === 'duplicateTargetRule') {
      this.setState({
        rule: {
          ...omit(data, ['id']),
          name: data.name + ' copy',
        } as UnsavedIssueAlertRule,
      });
    }
  }

  onLoadAllEndpointsSuccess() {
    const {rule} = this.state;
    const {
      params: {ruleId},
    } = this.props;
    if (rule) {
      ((rule as IssueAlertRule)?.errors || []).map(({detail}) =>
        addErrorMessage(detail, {append: true})
      );
    }

    if (!ruleId && !this.isDuplicateRule) {
      // now that we've loaded all the possible conditions, we can populate the
      // value of conditions for a new alert
      this.handleChange('conditions', [{id: IssueAlertConditionType.FIRST_SEEN_EVENT}]);
    }
  }

  pollHandler = async (quitTime: number) => {
    if (Date.now() > quitTime) {
      addErrorMessage(t('Looking for that channel took too long :('));
      this.setState({loading: false});
      return;
    }

    const {organization} = this.props;
    const {project} = this.state;
    const origRule = this.state.rule;

    try {
      const response: RuleTaskResponse = await this.api.requestPromise(
        `/projects/${organization.slug}/${project.slug}/rule-task/${this.uuid}/`
      );

      const {status, rule, error} = response;

      if (status === 'pending') {
        window.clearTimeout(this.pollingTimeout);

        this.pollingTimeout = window.setTimeout(() => {
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

  // As more incompatible combinations are added, we will need a more generic way to check for incompatibility.
  checkIncompatibleRuleDebounced = debounce(() => {
    const {conditionIndices, filterIndices} = findIncompatibleRules(this.state.rule);
    if (
      !this.trackIncompatibleAnalytics &&
      (conditionIndices !== null || filterIndices !== null)
    ) {
      this.trackIncompatibleAnalytics = true;
      trackAnalytics('edit_alert_rule.incompatible_rule', {
        organization: this.props.organization,
      });
    }
    this.setState({
      incompatibleConditions: conditionIndices,
      incompatibleFilters: filterIndices,
    });
  }, 500);

  fetchEnvironments() {
    const {organization} = this.props;
    const {project} = this.state;

    this.api
      .requestPromise(`/projects/${organization.slug}/${project.slug}/environments/`, {
        query: {
          visibility: 'visible',
        },
      })
      .then(response => this.setState({environments: response}))
      .catch(_err => addErrorMessage(t('Unable to fetch environments')));
  }

  refetchConfigs = () => {
    const {organization} = this.props;
    const {project} = this.state;

    this.api
      .requestPromise(
        `/projects/${organization.slug}/${project.slug}/rules/configuration/`
      )
      .then(response => this.setState({configs: response}))
      .catch(() => {
        // No need to alert user if this fails, can use existing data
      });
  };

  fetchStatus() {
    // pollHandler calls itself until it gets either a success
    // or failed status but we don't want to poll forever so we pass
    // in a hard stop time of 3 minutes before we bail.
    const quitTime = Date.now() + POLLING_MAX_TIME_LIMIT;
    window.clearTimeout(this.pollingTimeout);

    this.pollingTimeout = window.setTimeout(() => {
      this.pollHandler(quitTime);
    }, 1000);
  }

  testNotifications = () => {
    const {organization} = this.props;
    const {project, rule} = this.state;
    this.setState({detailedError: null, sendingNotification: true});
    const actions = rule?.actions ? rule?.actions.length : 0;
    addLoadingMessage(
      tn('Sending a test notification...', 'Sending test notifications...', actions)
    );
    this.api
      .requestPromise(`/projects/${organization.slug}/${project.slug}/rule-actions/`, {
        method: 'POST',
        data: {
          actions: rule?.actions ?? [],
        },
      })
      .then(() => {
        addSuccessMessage(tn('Notification sent!', 'Notifications sent!', actions));
        trackAnalytics('edit_alert_rule.notification_test', {
          organization,
          success: true,
        });
      })
      .catch(error => {
        addErrorMessage(tn('Notification failed', 'Notifications failed', actions));
        this.setState({detailedError: error.responseJSON || null});
        trackAnalytics('edit_alert_rule.notification_test', {
          organization,
          success: false,
        });
      })
      .finally(() => {
        this.setState({sendingNotification: false});
      });
  };

  handleRuleSuccess = (isNew: boolean, rule: IssueAlertRule) => {
    const {organization, router} = this.props;
    const {project} = this.state;
    // The onboarding task will be completed on the server side when the alert
    // is created
    updateOnboardingTask(null, organization, {
      task: OnboardingTaskKey.ALERT_RULE,
      status: 'complete',
    });

    metric.endSpan({name: 'saveAlertRule'});

    router.push(
      makeAlertsPathname({
        path: `/rules/${project.slug}/${rule.id}/details/`,
        organization,
      })
    );
    addSuccessMessage(isNew ? t('Created alert rule') : t('Updated alert rule'));
  };

  handleRuleSaveFailure(msg: ReactNode) {
    addErrorMessage(msg);
    metric.endSpan({name: 'saveAlertRule'});
  }

  handleSubmit = async () => {
    const {project, rule} = this.state;
    const ruleId = isSavedAlertRule(rule) ? `${rule.id}/` : '';
    const isNew = !ruleId;
    const {organization} = this.props;

    const endpoint = `/projects/${organization.slug}/${project.slug}/rules/${ruleId}`;

    if (rule && rule.environment === ALL_ENVIRONMENTS_KEY) {
      delete rule.environment;
    }

    // Check conditions exist or they've accepted a noisy alert
    if (this.displayNoConditionsWarning() && !this.state.acceptedNoisyAlert) {
      this.setState({detailedError: {acceptedNoisyAlert: [t('Required')]}});
      return;
    }

    addLoadingMessage();

    await Sentry.withScope(async scope => {
      try {
        scope.setTag('type', 'issue');
        scope.setTag('operation', isNew ? 'create' : 'edit');

        if (rule) {
          for (const action of rule.actions) {
            if (action.id === IssueAlertActionType.SLACK) {
              scope?.setTag('SlackNotifyServiceAction', true);
            }
            // to avoid storing inconsistent data in the db, don't pass the name fields
            delete action.name;
          }
          for (const condition of rule.conditions) {
            // values of 0 must be manually changed to strings, otherwise they will be interpreted as missing by the serializer
            if ('value' in condition && condition.value === 0) {
              condition.value = '0';
            }
            delete condition.name;
          }
          for (const filter of rule.filters) {
            delete filter.name;
          }
          scope.setExtra('actions', rule.actions);

          // Check if rule is currently disabled or going to be disabled
          if ('status' in rule && (rule.status === 'disabled' || !!rule.disableDate)) {
            rule.optOutEdit = true;
          }
        }

        metric.startSpan({name: 'saveAlertRule'});

        const [data, , resp] = await this.api.requestPromise(endpoint, {
          includeAllArgs: true,
          method: isNew ? 'POST' : 'PUT',
          data: rule,
          query: {
            duplicateRule: this.isDuplicateRule ? 'true' : 'false',
            wizardV3: 'true',
          },
        });

        // if we get a 202 back it means that we have an async task
        // running to lookup and verify the channel id for Slack.
        if (resp?.status === 202) {
          this.uuid = data.uuid;
          this.setState({detailedError: null, loading: true});
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
    });
  };

  handleDeleteRule = async () => {
    const {project, rule} = this.state;
    const ruleId = isSavedAlertRule(rule) ? `${rule.id}/` : '';
    const isNew = !ruleId;
    const {organization} = this.props;

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
      browserHistory.replace(
        recreateRoute('', {
          ...this.props,
          params: {...this.props.params, orgId: organization.slug},
          stepBack: -2,
        })
      );
    } catch (err) {
      this.setState({
        detailedError: err.responseJSON || {__all__: 'Unknown error'},
      });
      addErrorMessage(t('There was a problem deleting the alert'));
    }
  };

  handleCancel = () => {
    const {organization, router} = this.props;

    router.push(normalizeUrl(`/organizations/${organization.slug}/alerts/rules/`));
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
    type: ConfigurationKey,
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

  getInitialValue = (
    type: ConfigurationKey,
    id: string
  ): IssueAlertConfiguration[ConfigurationKey] => {
    const configuration = this.state.configs?.[type]?.find((c: any) => c.id === id);

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
    type: ConfigurationKey,
    idx: number,
    prop: T,
    val: IssueAlertRuleAction[T]
  ) => {
    this.setState(prevState => {
      const clonedState = cloneDeep(prevState);

      // Set initial configuration, but also set
      const id = (clonedState.rule as IssueAlertRule)[type][idx]!.id;
      const newRule = {
        ...this.getInitialValue(type, id),
        id,
        [prop]: val,
      };

      set(clonedState, `rule[${type}][${idx}]`, newRule);
      return clonedState;
    });
  };

  handleAddRow = (type: ConfigurationKey, item: IssueAlertRuleActionTemplate) => {
    this.setState(prevState => {
      const clonedState = cloneDeep(prevState);

      // Set initial configuration
      const newRule = {
        ...this.getInitialValue(type, item.id),
        id: item.id,
        sentryAppInstallationUuid: item.sentryAppInstallationUuid,
      };
      const newTypeList = prevState.rule ? prevState.rule[type] : [];

      set(clonedState, `rule[${type}]`, [...newTypeList, newRule]);
      return clonedState;
    });

    const {organization} = this.props;
    const {project} = this.state;
    trackAnalytics('edit_alert_rule.add_row', {
      organization,
      project_id: project.id,
      type,
      name: item.id,
    });
  };

  handleDeleteRow = (type: ConfigurationKey, idx: number) => {
    this.setState(prevState => {
      const clonedState = cloneDeep(prevState);

      const newTypeList = prevState.rule ? [...prevState.rule[type]] : [];
      newTypeList.splice(idx, 1);

      set(clonedState, `rule[${type}]`, newTypeList);

      const {organization} = this.props;
      const {project} = this.state;
      const deletedItem = prevState.rule ? prevState.rule[type][idx] : null;
      trackAnalytics('edit_alert_rule.delete_row', {
        organization,
        project_id: project.id,
        type,
        name: deletedItem?.id ?? '',
      });
      return clonedState;
    });
  };

  handleAddCondition = (template: IssueAlertRuleActionTemplate) =>
    this.handleAddRow('conditions', template);
  handleAddAction = (template: IssueAlertRuleActionTemplate) =>
    this.handleAddRow('actions', template);
  handleAddFilter = (template: IssueAlertRuleActionTemplate) =>
    this.handleAddRow('filters', template);
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

  getConditions(): IssueAlertConfiguration['conditions'] | null {
    const {organization} = this.props;

    if (!organization.features.includes('change-alerts')) {
      return this.state.configs?.conditions ?? null;
    }
    let conditions = this.state.configs?.conditions ?? null;

    if (conditions === null) {
      return null;
    }

    if (
      !organization.features.includes(
        'event-unique-user-frequency-condition-with-conditions'
      )
    ) {
      conditions = conditions?.filter(
        condition =>
          condition.id !==
          'sentry.rules.conditions.event_frequency.EventUniqueUserFrequencyConditionWithConditions'
      );
    }

    conditions = conditions?.map(condition =>
      CHANGE_ALERT_CONDITION_IDS.includes(condition.id)
        ? {
            ...condition,
            // @ts-expect-error TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
            label: `${CHANGE_ALERT_PLACEHOLDERS_LABELS[condition.id]}...`,
          }
        : condition
    );

    return conditions;
  }

  getTeamId = () => {
    const {rule} = this.state;
    const owner = rule?.owner;
    // ownership follows the format team:<id>, just grab the id
    return owner?.split(':')[1];
  };

  handleOwnerChange = ({value}: {value: string}) => {
    const ownerValue = value && `team:${value}`;
    this.handleChange('owner', ownerValue);
  };

  renderLoading() {
    return this.renderBody();
  }

  renderError() {
    return (
      <Alert type="error" showIcon>
        {t(
          'Unable to access this alert rule -- check to make sure you have the correct permissions'
        )}
      </Alert>
    );
  }

  renderRuleName(disabled: boolean) {
    const {rule, detailedError} = this.state;
    const {name} = rule || {};

    // Duplicate errors display on the "name" field but we're showing them in a banner
    // Remove them from the name detailed error
    const filteredDetailedError =
      detailedError?.name?.filter(str => !isExactDuplicateExp.test(str)) ?? [];

    return (
      <StyledField
        label={null}
        help={null}
        error={filteredDetailedError[0]}
        disabled={disabled}
        required
        stacked
        flexibleControlStateSize
      >
        <Input
          type="text"
          name="name"
          value={name}
          data-test-id="alert-name"
          placeholder={t('Enter Alert Name')}
          onChange={(event: ChangeEvent<HTMLInputElement>) =>
            this.handleChange('name', event.target.value)
          }
          onBlur={this.handleValidateRuleName}
          disabled={disabled}
        />
      </StyledField>
    );
  }

  renderTeamSelect(disabled: boolean) {
    const {rule, project} = this.state;
    const ownerId = rule?.owner?.split(':')[1];

    return (
      <StyledField label={null} help={null} disabled={disabled} flexibleControlStateSize>
        <TeamSelector
          value={this.getTeamId()}
          project={project}
          onChange={this.handleOwnerChange}
          teamFilter={(team: Team) =>
            team.isMember || team.id === ownerId || team.access.includes('team:admin')
          }
          useId
          includeUnassigned
          disabled={disabled}
        />
      </StyledField>
    );
  }

  renderDuplicateErrorAlert() {
    const {organization} = this.props;
    const {detailedError, project} = this.state;
    const duplicateName = isExactDuplicateExp.exec(detailedError?.name?.[0] ?? '')?.[1];
    const duplicateRuleId = detailedError?.ruleId?.[0] ?? '';

    // We want this to open in a new tab to not lose the current state of the rule editor
    return (
      <AlertLink
        openInNewTab
        priority="error"
        icon={<IconNot color="red300" />}
        href={makeAlertsPathname({
          path: `/rules/${project.slug}/${duplicateRuleId}/details/`,
          organization,
        })}
      >
        {tct(
          'This rule fully duplicates "[alertName]" in the project [projectName] and cannot be saved.',
          {
            alertName: duplicateName,
            projectName: project.name,
          }
        )}
      </AlertLink>
    );
  }

  displayNoConditionsWarning(): boolean {
    const {rule} = this.state;
    const acceptedNoisyActionIds: string[] = [
      // Webhooks
      IssueAlertActionType.NOTIFY_EVENT_SERVICE_ACTION,
      // Legacy integrations
      IssueAlertActionType.NOTIFY_EVENT_ACTION,
    ];

    return (
      !!rule &&
      !isSavedAlertRule(rule) &&
      rule.conditions.length === 0 &&
      rule.filters.length === 0 &&
      !rule.actions.every(action => acceptedNoisyActionIds.includes(action.id))
    );
  }

  renderAcknowledgeNoConditions(disabled: boolean) {
    const {detailedError, acceptedNoisyAlert} = this.state;

    // Bit goofy to do in render but should only track onceish
    if (!this.trackNoisyWarningViewed) {
      this.trackNoisyWarningViewed = true;
      trackAnalytics('alert_builder.noisy_warning_viewed', {
        organization: this.props.organization,
      });
    }

    return (
      <Alert type="warning" showIcon>
        <div>
          {t(
            'Alerts without conditions can fire too frequently. Are you sure you want to save this alert rule?'
          )}
        </div>
        <AcknowledgeField
          label={null}
          help={null}
          error={detailedError?.acceptedNoisyAlert?.[0]}
          disabled={disabled}
          required
          stacked
          flexibleControlStateSize
          inline
        >
          <AcknowledgeLabel>
            <Checkbox
              size="sm"
              name="acceptedNoisyAlert"
              checked={acceptedNoisyAlert}
              onChange={() => {
                this.setState({acceptedNoisyAlert: !acceptedNoisyAlert});
                if (!acceptedNoisyAlert) {
                  trackAnalytics('alert_builder.noisy_warning_agreed', {
                    organization: this.props.organization,
                  });
                }
              }}
              disabled={disabled}
            />
            {t('Yes, I don’t mind if this alert gets noisy')}
          </AcknowledgeLabel>
        </AcknowledgeField>
      </Alert>
    );
  }

  renderIdBadge(project: Project) {
    return (
      <IdBadge
        project={project}
        avatarProps={{consistentWidth: true}}
        avatarSize={18}
        disableLink
        hideName
      />
    );
  }

  renderEnvironmentSelect(disabled: boolean) {
    const {environments, rule} = this.state;

    const environmentOptions = [
      {
        value: ALL_ENVIRONMENTS_KEY,
        label: t('All Environments'),
      },
      ...(environments?.map(env => ({value: env.name, label: getDisplayName(env)})) ??
        []),
    ];

    const environment =
      !rule || !rule.environment ? ALL_ENVIRONMENTS_KEY : rule.environment;

    return (
      <FormField
        name="environment"
        inline={false}
        style={{padding: 0, border: 'none'}}
        flexibleControlStateSize
        className={this.hasError('environment') ? ' error' : ''}
        required
        disabled={disabled}
      >
        {({onChange, onBlur}: any) => (
          <SelectControl
            clearable={false}
            disabled={disabled}
            value={environment}
            options={environmentOptions}
            onChange={({value}: any) => {
              this.handleEnvironmentChange(value);
              onChange(value, {});
              onBlur(value, {});
            }}
          />
        )}
      </FormField>
    );
  }

  renderProjectSelect(disabled: boolean) {
    const {project: _selectedProject, projects, organization} = this.props;
    const {rule} = this.state;

    const projectOptions = getProjectOptions({
      organization,
      projects,
      isFormDisabled: disabled,
    });

    return (
      <FormField
        name="projectId"
        inline={false}
        style={{padding: 0}}
        flexibleControlStateSize
      >
        {({onChange, onBlur, model}: any) => {
          const selectedProject =
            projects.find(({id}) => id === model.getValue('projectId')) ||
            _selectedProject;

          return (
            <SelectControl
              disabled={disabled || isSavedAlertRule(rule)}
              value={selectedProject.id}
              styles={{
                container: (provided: {[x: string]: string | number | boolean}) => ({
                  ...provided,
                  marginBottom: `${space(1)}`,
                }),
              }}
              options={projectOptions}
              onChange={({value}: {value: Project['id']}) => {
                // if the current owner/team isn't part of project selected, update to the first available team
                const nextSelectedProject =
                  projects.find(({id}) => id === value) ?? selectedProject;
                const ownerId: string | undefined = model
                  .getValue('owner')
                  ?.split(':')[1];
                if (
                  ownerId &&
                  nextSelectedProject.teams.find(({id}) => id === ownerId) ===
                    undefined &&
                  nextSelectedProject.teams.length
                ) {
                  this.handleOwnerChange({value: nextSelectedProject.teams[0]!.id});
                }

                this.setState({project: nextSelectedProject});

                onChange(value, {});
                onBlur(value, {});
              }}
              components={{
                SingleValue: (containerProps: any) => (
                  <components.ValueContainer {...containerProps}>
                    <IdBadge
                      project={selectedProject}
                      avatarProps={{consistentWidth: true}}
                      avatarSize={18}
                      disableLink
                    />
                  </components.ValueContainer>
                ),
              }}
            />
          );
        }}
      </FormField>
    );
  }

  renderActionInterval(disabled: boolean) {
    const {rule} = this.state;
    const {frequency} = rule || {};

    return (
      <FormField
        name="frequency"
        inline={false}
        style={{padding: 0, border: 'none'}}
        label={null}
        help={null}
        className={this.hasError('frequency') ? ' error' : ''}
        required
        disabled={disabled}
        flexibleControlStateSize
      >
        {({onChange, onBlur}: any) => (
          <SelectControl
            clearable={false}
            disabled={disabled}
            value={`${frequency}`}
            options={FREQUENCY_OPTIONS}
            onChange={({value}: any) => {
              this.handleChange('frequency', value);
              onChange(value, {});
              onBlur(value, {});
            }}
          />
        )}
      </FormField>
    );
  }

  renderBody() {
    const {organization, members} = this.props;
    const {
      project,
      rule,
      detailedError,
      loading,
      sendingNotification,
      incompatibleConditions,
      incompatibleFilters,
    } = this.state;
    const {actions, filters, conditions, frequency} = rule || {};

    const environment =
      !rule || !rule.environment ? ALL_ENVIRONMENTS_KEY : rule.environment;

    const canCreateAlert = hasEveryAccess(['alerts:write'], {organization, project});
    const disabled = loading || !(canCreateAlert || isActiveSuperuser());
    const displayDuplicateError =
      detailedError?.name?.some(str => isExactDuplicateExp.test(str)) ?? false;

    // Note `key` on `<Form>` below is so that on initial load, we show
    // the form with a loading mask on top of it, but force a re-render by using
    // a different key when we have fetched the rule so that form inputs are filled in
    return (
      <Main fullWidth>
        <SentryDocumentTitle
          title={rule ? t('Alert — %s', rule.name) : t('New Alert Rule')}
          orgSlug={organization.slug}
          projectSlug={project.slug}
        />
        <ProjectPermissionAlert access={['alerts:write']} project={project} />
        <StyledForm
          key={isSavedAlertRule(rule) ? rule.id : undefined}
          onCancel={this.handleCancel}
          onSubmit={this.handleSubmit}
          initialData={{
            ...rule,
            environment,
            frequency: `${frequency}`,
            projectId: project.id,
          }}
          submitDisabled={
            disabled || incompatibleConditions !== null || incompatibleFilters !== null
          }
          submitLabel={t('Save Rule')}
          extraButton={
            isSavedAlertRule(rule) ? (
              <Confirm
                disabled={disabled}
                priority="danger"
                confirmText={t('Delete Rule')}
                onConfirm={this.handleDeleteRule}
                header={<h5>{t('Delete Alert Rule?')}</h5>}
                message={t(
                  'Are you sure you want to delete "%s"? You won\'t be able to view the history of this alert once it\'s deleted.',
                  rule.name
                )}
              >
                <Button priority="danger">{t('Delete Rule')}</Button>
              </Confirm>
            ) : null
          }
        >
          <List symbol="colored-numeric">
            {loading && <SemiTransparentLoadingMask data-test-id="loading-mask" />}
            <StyledListItem>
              <StepHeader>{t('Select an environment and project')}</StepHeader>
            </StyledListItem>
            <ContentIndent>
              <SettingsContainer>
                {this.renderEnvironmentSelect(disabled)}
                {this.renderProjectSelect(disabled)}
              </SettingsContainer>
            </ContentIndent>
            <SetConditionsListItem>
              <StepHeader>{t('Set conditions')}</StepHeader>{' '}
              <SetupMessagingIntegrationButton
                projectId={project.id}
                refetchConfigs={this.refetchConfigs}
                analyticsView={MessagingIntegrationAnalyticsView.ALERT_RULE_CREATION}
              />
            </SetConditionsListItem>
            <ContentIndent>
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
                                    styles={{
                                      control: (provided: any) => ({
                                        ...provided,
                                        minHeight: '21px',
                                        height: '21px',
                                      }),
                                    }}
                                    inline={false}
                                    isSearchable={false}
                                    isClearable={false}
                                    name="actionMatch"
                                    required
                                    flexibleControlStateSize
                                    options={ACTION_MATCH_OPTIONS_MIGRATED}
                                    onChange={(val: any) =>
                                      this.handleChange('actionMatch', val)
                                    }
                                    size="xs"
                                    disabled={disabled}
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
                          placeholder={t('Add optional trigger...')}
                          onPropertyChange={this.handleChangeConditionProperty}
                          onAddRow={this.handleAddCondition}
                          onResetRow={this.handleResetCondition}
                          onDeleteRow={this.handleDeleteCondition}
                          organization={organization}
                          project={project}
                          disabled={disabled}
                          error={
                            this.hasError('conditions') && (
                              <StyledAlert type="error">
                                {detailedError?.conditions![0]}
                                {(detailedError?.conditions![0] || '').startsWith(
                                  'You may not exceed'
                                ) && (
                                  <Fragment>
                                    {' '}
                                    <ExternalLink href="https://docs.sentry.io/product/alerts/create-alerts/#alert-limits">
                                      {t('View Docs')}
                                    </ExternalLink>
                                  </Fragment>
                                )}
                              </StyledAlert>
                            )
                          }
                          incompatibleRules={incompatibleConditions}
                          incompatibleBanner={
                            incompatibleFilters === null &&
                            incompatibleConditions !== null
                              ? incompatibleConditions.at(-1)
                              : null
                          }
                        />
                      </StepContent>
                    </StepContainer>
                  </Step>

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

                      <StepContent data-test-id="rule-filters">
                        <StepLead>
                          {tct('[if:If][selector] of these filters match', {
                            if: <Badge />,
                            selector: (
                              <EmbeddedWrapper>
                                <EmbeddedSelectField
                                  className={classNames({
                                    error: this.hasError('filterMatch'),
                                  })}
                                  styles={{
                                    control: (provided: any) => ({
                                      ...provided,
                                      minHeight: '21px',
                                      height: '21px',
                                    }),
                                  }}
                                  inline={false}
                                  isSearchable={false}
                                  isClearable={false}
                                  name="filterMatch"
                                  required
                                  flexibleControlStateSize
                                  options={ACTION_MATCH_OPTIONS}
                                  onChange={(val: any) =>
                                    this.handleChange('filterMatch', val)
                                  }
                                  size="xs"
                                  disabled={disabled}
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
                          disabled={disabled}
                          error={
                            this.hasError('filters') && (
                              <StyledAlert type="error">
                                {detailedError?.filters![0]}
                              </StyledAlert>
                            )
                          }
                          incompatibleRules={incompatibleFilters}
                          incompatibleBanner={
                            incompatibleFilters ? incompatibleFilters.at(-1) : null
                          }
                        />
                        <FeedbackAlertBanner
                          filters={this.state.rule?.filters}
                          projectSlug={this.state.project.slug}
                        />
                      </StepContent>
                    </StepContainer>
                  </Step>

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
                          disabled={disabled}
                          error={
                            this.hasError('actions') && (
                              <StyledAlert type="error">
                                {detailedError?.actions![0]}
                              </StyledAlert>
                            )
                          }
                          additionalAction={{
                            label: 'Notify integration\u{2026}',
                            option: {
                              label: 'Missing an integration? Click here to refresh',
                              value: {
                                enabled: true,
                                id: 'refresh_configs',
                                label: 'Refresh Integration List',
                              },
                            },
                            onClick: () => {
                              this.refetchConfigs();
                            },
                          }}
                        />
                        <TestButtonWrapper>
                          <Button
                            onClick={this.testNotifications}
                            disabled={sendingNotification || rule?.actions?.length === 0}
                          >
                            {t('Send Test Notification')}
                          </Button>
                        </TestButtonWrapper>
                      </StepContent>
                    </StepContainer>
                  </Step>
                </PanelBody>
              </ConditionsPanel>
            </ContentIndent>
            <StyledListItem>
              <StepHeader>{t('Set action interval')}</StepHeader>
              <StyledFieldHelp>
                {t('Perform the actions above once this often for an issue')}
              </StyledFieldHelp>
            </StyledListItem>
            <ContentIndent>{this.renderActionInterval(disabled)}</ContentIndent>
            <ErrorBoundary mini>
              <PreviewIssues members={members} rule={rule} project={project} />
            </ErrorBoundary>
            <StyledListItem>
              <StepHeader>{t('Add a name and owner')}</StepHeader>
              <StyledFieldHelp>
                {t(
                  'This name will show up in notifications and the owner will give permissions to your whole team to edit and view this alert.'
                )}
              </StyledFieldHelp>
            </StyledListItem>
            <ContentIndent>
              <StyledFieldWrapper>
                {this.renderRuleName(disabled)}
                {this.renderTeamSelect(disabled)}
              </StyledFieldWrapper>
              {displayDuplicateError && this.renderDuplicateErrorAlert()}
              {this.displayNoConditionsWarning() &&
                this.renderAcknowledgeNoConditions(disabled)}
            </ContentIndent>
          </List>
        </StyledForm>
      </Main>
    );
  }
}

export default withOrganization(withProjects(IssueRuleEditor));

export const findIncompatibleRules = (
  rule: IssueAlertRule | UnsavedIssueAlertRule | null | undefined
): IncompatibleRule => {
  if (!rule) {
    return {conditionIndices: null, filterIndices: null};
  }

  const {conditions, filters} = rule;
  // Check for more than one 'issue state change' condition
  // or 'FirstSeenEventCondition' + 'EventFrequencyCondition'
  if (rule.actionMatch === 'all') {
    let firstSeen = -1;
    let regression = -1;
    let reappeared = -1;
    let eventFrequency = -1;
    let userFrequency = -1;
    for (let i = 0; i < conditions.length; i++) {
      const id = conditions[i]!.id;
      if (id === IssueAlertConditionType.FIRST_SEEN_EVENT) {
        firstSeen = i;
      } else if (id === IssueAlertConditionType.REGRESSION_EVENT) {
        regression = i;
      } else if (id === IssueAlertConditionType.REAPPEARED_EVENT) {
        reappeared = i;
      } else if (
        id === IssueAlertConditionType.EVENT_FREQUENCY &&
        (conditions[i]!.value as number) >= 1
      ) {
        eventFrequency = i;
      } else if (
        id === IssueAlertConditionType.EVENT_UNIQUE_USER_FREQUENCY &&
        (conditions[i]!.value as number) >= 1
      ) {
        userFrequency = i;
      }
      // FirstSeenEventCondition is incompatible with all the following types
      const firstSeenError =
        firstSeen !== -1 &&
        [regression, reappeared, eventFrequency, userFrequency].some(idx => idx !== -1);
      const regressionReappearedError = regression !== -1 && reappeared !== -1;
      if (firstSeenError || regressionReappearedError) {
        const indices = [firstSeen, regression, reappeared, eventFrequency, userFrequency]
          .filter(idx => idx !== -1)
          .sort((a, b) => a - b);
        return {conditionIndices: indices, filterIndices: null};
      }
    }
  }
  // Check for 'FirstSeenEventCondition' and ('IssueOccurrencesFilter' or 'AgeComparisonFilter')
  // Considers the case where filterMatch is 'any' and all filters are incompatible
  const firstSeen = conditions.findIndex(condition =>
    condition.id.endsWith('FirstSeenEventCondition')
  );
  if (firstSeen !== -1 && (rule.actionMatch === 'all' || conditions.length === 1)) {
    let incompatibleFilters = 0;
    for (let i = 0; i < filters.length; i++) {
      const filter = filters[i]!;
      const id = filter.id;
      if (id === IssueAlertFilterType.ISSUE_OCCURRENCES && filter) {
        if (
          (rule.filterMatch === 'all' && (filter.value as number) > 1) ||
          (rule.filterMatch === 'none' && (filter.value as number) <= 1)
        ) {
          return {conditionIndices: [firstSeen], filterIndices: [i]};
        }
        if (rule.filterMatch === 'any' && (filter.value as number) > 1) {
          incompatibleFilters += 1;
        }
      } else if (id === IssueAlertFilterType.AGE_COMPARISON) {
        if (rule.filterMatch !== 'none') {
          if (filter.comparison_type === 'older') {
            if (rule.filterMatch === 'all') {
              return {conditionIndices: [firstSeen], filterIndices: [i]};
            }
            incompatibleFilters += 1;
          }
        } else if (filter.comparison_type === 'newer' && (filter.value as number) > 0) {
          return {conditionIndices: [firstSeen], filterIndices: [i]};
        }
      }
    }
    if (incompatibleFilters === filters.length && incompatibleFilters > 0) {
      return {
        conditionIndices: [firstSeen],
        filterIndices: [...Array(filters.length).keys()],
      };
    }
  }
  return {conditionIndices: null, filterIndices: null};
};

const Main = styled(Layout.Main)`
  max-width: 1000px;
`;

// TODO(ts): Understand why styled is not correctly inheriting props here
const StyledForm = styled(Form)<FormProps>`
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

const StyledFieldHelp = styled(FieldHelp)`
  margin-top: 0;
  @media (max-width: ${p => p.theme.breakpoints.small}) {
    margin-left: -${space(4)};
  }
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

const StepHeader = styled('h5')`
  margin-bottom: ${space(1)};
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
  display: flex;
  align-items: center;
  gap: ${space(0.5)};
`;

const TestButtonWrapper = styled('div')`
  margin-top: ${space(1.5)};
`;

const ChevronContainer = styled('div')`
  display: flex;
  align-items: center;
  padding: ${space(0.5)} ${space(1.5)};
`;

const Badge = styled('span')`
  min-width: 56px;
  background-color: ${p => p.theme.purple300};
  padding: 0 ${space(0.75)};
  border-radius: ${p => p.theme.borderRadius};
  color: ${p => p.theme.white};
  text-transform: uppercase;
  text-align: center;
  font-size: ${p => p.theme.fontSizeMedium};
  font-weight: ${p => p.theme.fontWeightBold};
  line-height: 1.5;
`;

const EmbeddedWrapper = styled('div')`
  width: 80px;
`;

const EmbeddedSelectField = styled(SelectField)`
  padding: 0;
  font-weight: ${p => p.theme.fontWeightNormal};
  text-transform: none;
`;

const SemiTransparentLoadingMask = styled(LoadingMask)`
  opacity: 0.6;
  z-index: 1; /* Needed so that it sits above form elements */
`;

const SettingsContainer = styled('div')`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: ${space(1)};
`;

const StyledField = styled(FieldGroup)`
  border-bottom: none;
  padding: 0;

  & > div {
    padding: 0;
    width: 100%;
  }
  margin-bottom: ${space(1)};
`;

const StyledFieldWrapper = styled('div')`
  @media (min-width: ${p => p.theme.breakpoints.small}) {
    display: grid;
    grid-template-columns: 2fr 1fr;
    gap: ${space(1)};
  }
`;

const ContentIndent = styled('div')`
  @media (min-width: ${p => p.theme.breakpoints.small}) {
    margin-left: ${space(4)};
  }
`;

const AcknowledgeLabel = styled('label')`
  display: flex;
  align-items: center;
  gap: ${space(1)};
  line-height: 2;
  font-weight: ${p => p.theme.fontWeightNormal};
`;

const AcknowledgeField = styled(FieldGroup)`
  padding: 0;
  display: flex;
  align-items: center;
  margin-top: ${space(1)};

  & > div {
    padding-left: 0;
    display: flex;
    align-items: baseline;
    flex: unset;
    gap: ${space(1)};
  }
`;
