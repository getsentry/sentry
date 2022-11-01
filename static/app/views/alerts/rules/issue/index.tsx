import {ChangeEvent, ReactNode} from 'react';
import {browserHistory, RouteComponentProps} from 'react-router';
import {components} from 'react-select';
import styled from '@emotion/styled';
import classNames from 'classnames';
import {Location} from 'history';
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
import Access from 'sentry/components/acl/access';
import Feature from 'sentry/components/acl/feature';
import Alert from 'sentry/components/alert';
import Button from 'sentry/components/button';
import Confirm from 'sentry/components/confirm';
import SelectControl from 'sentry/components/forms/controls/selectControl';
import Field from 'sentry/components/forms/field';
import FieldHelp from 'sentry/components/forms/field/fieldHelp';
import SelectField from 'sentry/components/forms/fields/selectField';
import Form, {FormProps} from 'sentry/components/forms/form';
import FormField from 'sentry/components/forms/formField';
import IdBadge from 'sentry/components/idBadge';
import Input from 'sentry/components/input';
import * as Layout from 'sentry/components/layouts/thirds';
import List from 'sentry/components/list';
import ListItem from 'sentry/components/list/listItem';
import LoadingMask from 'sentry/components/loadingMask';
import {CursorHandler} from 'sentry/components/pagination';
import {Panel, PanelBody} from 'sentry/components/panels';
import TeamSelector from 'sentry/components/teamSelector';
import {ALL_ENVIRONMENTS_KEY} from 'sentry/constants';
import {IconChevron} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import GroupStore from 'sentry/stores/groupStore';
import space from 'sentry/styles/space';
import {
  Environment,
  IssueOwnership,
  Member,
  OnboardingTaskKey,
  Organization,
  Project,
  Team,
} from 'sentry/types';
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
import withProjects from 'sentry/utils/withProjects';
import PreviewTable from 'sentry/views/alerts/rules/issue/previewTable';
import {
  CHANGE_ALERT_CONDITION_IDS,
  CHANGE_ALERT_PLACEHOLDERS_LABELS,
} from 'sentry/views/alerts/utils/constants';
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

const SENTRY_ISSUE_ALERT_DOCS_URL =
  'https://docs.sentry.io/product/alerts/alert-types/#issue-alerts';

type ConditionOrActionProperty = 'conditions' | 'actions' | 'filters';

type RuleTaskResponse = {
  status: 'pending' | 'failed' | 'success';
  error?: string;
  rule?: IssueAlertRule;
};

type RouteParams = {orgId: string; projectId?: string; ruleId?: string};

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
  incompatibleCondition: number | null;
  incompatibleFilter: number | null;
  issueCount: number;
  loadingPreview: boolean;
  previewCursor: string | null | undefined;
  previewError: boolean;
  previewGroups: string[] | null;
  previewPage: number;
  project: Project;
  sendingNotification: boolean;
  uuid: null | string;
  duplicateTargetRule?: UnsavedIssueAlertRule | IssueAlertRule | null;
  ownership?: null | IssueOwnership;
  rule?: UnsavedIssueAlertRule | IssueAlertRule | null;
};

function isSavedAlertRule(rule: State['rule']): rule is IssueAlertRule {
  return rule?.hasOwnProperty('id') ?? false;
}

class IssueRuleEditor extends AsyncView<Props, State> {
  pollingTimeout: number | undefined = undefined;

  get isDuplicateRule(): boolean {
    const {location} = this.props;
    const createFromDuplicate = location?.query.createFromDuplicate === 'true';
    return createFromDuplicate && location?.query.duplicateRuleId;
  }

  componentWillMount() {
    this.fetchPreview();
  }

  componentWillUnmount() {
    GroupStore.reset();
    window.clearTimeout(this.pollingTimeout);
  }

  componentDidUpdate(_prevProps: Props, prevState: State) {
    if (prevState.previewCursor !== this.state.previewCursor) {
      this.fetchPreview();
    } else if (this.isRuleStateChange(prevState)) {
      this.setState({
        loadingPreview: true,
        incompatibleCondition: null,
        incompatibleFilter: null,
      });
      this.fetchPreviewDebounced();
      this.checkIncompatibleRule();
    }
    if (prevState.project.id === this.state.project.id) {
      return;
    }

    this.fetchEnvironments();
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

  getTitle() {
    const {organization} = this.props;
    const {rule, project} = this.state;
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
      project,
      previewGroups: null,
      previewCursor: null,
      previewError: false,
      issueCount: 0,
      previewPage: 0,
      loadingPreview: false,
      sendingNotification: false,
      incompatibleCondition: null,
      incompatibleFilter: null,
    };

    const projectTeamIds = new Set(project.teams.map(({id}) => id));
    const userTeamId = userTeamIds.find(id => projectTeamIds.has(id)) ?? null;
    defaultState.rule.owner = userTeamId && `team:${userTeamId}`;

    return defaultState;
  }

  getEndpoints(): ReturnType<AsyncView['getEndpoints']> {
    const {
      location: {query},
      params: {ruleId, orgId},
    } = this.props;
    // project in state isn't initialized when getEndpoints is first called
    const project = this.state?.project ?? this.props.project;

    const endpoints = [
      [
        'environments',
        `/projects/${orgId}/${project.slug}/environments/`,
        {
          query: {
            visibility: 'visible',
          },
        },
      ],
      ['configs', `/projects/${orgId}/${project.slug}/rules/configuration/`],
      ['ownership', `/projects/${orgId}/${project.slug}/ownership/`],
    ];

    if (ruleId) {
      endpoints.push(['rule', `/projects/${orgId}/${project.slug}/rules/${ruleId}/`]);
    }

    if (!ruleId && query.createFromDuplicate && query.duplicateRuleId) {
      endpoints.push([
        'duplicateTargetRule',
        `/projects/${orgId}/${project.slug}/rules/${query.duplicateRuleId}/`,
      ]);
    }

    return endpoints as [string, string][];
  }

  onRequestSuccess({stateKey, data}) {
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
    if (rule) {
      ((rule as IssueAlertRule)?.errors || []).map(({detail}) =>
        addErrorMessage(detail, {append: true})
      );
    }
  }
  pollHandler = async (quitTime: number) => {
    if (Date.now() > quitTime) {
      addErrorMessage(t('Looking for that channel took too long :('));
      this.setState({loading: false});
      return;
    }

    const {organization} = this.props;
    const {uuid, project} = this.state;
    const origRule = this.state.rule;

    try {
      const response: RuleTaskResponse = await this.api.requestPromise(
        `/projects/${organization.slug}/${project.slug}/rule-task/${uuid}/`
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

  fetchPreview = (resetCursor = false) => {
    const {organization} = this.props;
    const {project, rule, previewCursor} = this.state;

    if (!rule || !organization.features.includes('issue-alert-preview')) {
      return;
    }

    this.setState({loadingPreview: true});
    if (resetCursor) {
      this.setState({previewCursor: null, previewPage: 0});
    }
    // we currently don't have a way to parse objects from query params, so this method is POST for now
    this.api
      .requestPromise(`/projects/${organization.slug}/${project.slug}/rules/preview`, {
        method: 'POST',
        includeAllArgs: true,
        query: {
          cursor: resetCursor ? null : previewCursor,
          per_page: 5,
        },
        data: {
          conditions: rule?.conditions || [],
          filters: rule?.filters || [],
          actionMatch: rule?.actionMatch || 'all',
          filterMatch: rule?.filterMatch || 'all',
          frequency: rule?.frequency || 60,
        },
      })
      .then(([data, _, resp]) => {
        GroupStore.add(data);

        const pageLinks = resp?.getResponseHeader('Link');
        const hits = resp?.getResponseHeader('X-Hits');
        const issueCount =
          typeof hits !== 'undefined' && hits ? parseInt(hits, 10) || 0 : 0;
        this.setState({
          previewGroups: data.map(g => g.id),
          previewError: false,
          pageLinks: pageLinks ?? '',
          issueCount,
          loadingPreview: false,
        });
      })
      .catch(_ => {
        this.setState({
          previewError: true,
          loadingPreview: false,
        });
      });
  };

  fetchPreviewDebounced = debounce(() => {
    this.fetchPreview(true);
  }, 1000);

  // As more incompatible combinations are added, we will need a more generic way to check for incompatibility.
  checkIncompatibleRule = debounce(() => {
    const {rule} = this.state;
    if (
      !rule ||
      !this.props.organization.features.includes('issue-alert-incompatible-rules')
    ) {
      return;
    }

    const {conditions, filters} = rule;
    // Check for more than one 'issue state change' condition
    // or 'FirstSeenEventCondition' + 'EventFrequencyCondition'
    if (rule.actionMatch === 'all') {
      let firstSeen = 0;
      let regression = 0;
      let reappeared = 0;
      let eventFrequency = 0;
      for (let i = 0; i < conditions.length; i++) {
        const id = conditions[i].id;
        if (id.endsWith('FirstSeenEventCondition')) {
          firstSeen = 1;
        } else if (id.endsWith('RegressionEventCondition')) {
          regression = 1;
        } else if (id.endsWith('ReappearedEventCondition')) {
          reappeared = 1;
        } else if (id.endsWith('EventFrequencyCondition') && conditions[i].value >= 1) {
          eventFrequency = 1;
        }
        if (firstSeen + regression + reappeared > 1 || firstSeen + eventFrequency > 1) {
          this.setState({incompatibleCondition: i});
          return;
        }
      }
    }
    // Check for 'FirstSeenEventCondition' and 'IssueOccurrencesFilter'
    const firstSeen = conditions.some(condition =>
      condition.id.endsWith('FirstSeenEventCondition')
    );
    if (
      firstSeen &&
      (rule.actionMatch === 'all' || conditions.length === 1) &&
      (rule.filterMatch === 'all' || (rule.filterMatch === 'any' && filters.length === 1))
    ) {
      for (let i = 0; i < filters.length; i++) {
        const id = filters[i].id;
        if (id.endsWith('IssueOccurrencesFilter') && filters[i].value > 1) {
          this.setState({incompatibleFilter: i});
          return;
        }
      }
    }
  }, 500);

  onPreviewCursor: CursorHandler = (cursor, _1, _2, direction) => {
    this.setState({
      previewCursor: cursor,
      previewPage: this.state.previewPage + direction,
    });
  };

  fetchEnvironments() {
    const {
      params: {orgId},
    } = this.props;
    const {project} = this.state;

    this.api
      .requestPromise(`/projects/${orgId}/${project.slug}/environments/`, {
        query: {
          visibility: 'visible',
        },
      })
      .then(response => this.setState({environments: response}))
      .catch(_err => addErrorMessage(t('Unable to fetch environments')));
  }

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
    this.setState({sendingNotification: true});
    addLoadingMessage(t('Sending a test notification...'));
    this.api
      .requestPromise(`/projects/${organization.slug}/${project.slug}/rule-actions/`, {
        method: 'POST',
        data: {
          actions: rule?.actions ?? [],
        },
      })
      .then(() => {
        addSuccessMessage(t('Notification sent!'));
      })
      .catch(() => {
        addErrorMessage(t('Notification failed'));
      })
      .finally(() => {
        this.setState({sendingNotification: false});
      });
  };

  handleRuleSuccess = (isNew: boolean, rule: IssueAlertRule) => {
    const {organization, router} = this.props;
    const {project} = this.state;
    this.setState({detailedError: null, loading: false, rule});

    // The onboarding task will be completed on the server side when the alert
    // is created
    updateOnboardingTask(null, organization, {
      task: OnboardingTaskKey.ALERT_RULE,
      status: 'complete',
    });

    metric.endTransaction({name: 'saveAlertRule'});

    router.push({
      pathname: `/organizations/${organization.slug}/alerts/rules/${project.slug}/${rule.id}/details/`,
    });
    addSuccessMessage(isNew ? t('Created alert rule') : t('Updated alert rule'));
  };

  handleRuleSaveFailure(msg: ReactNode) {
    addErrorMessage(msg);
    metric.endTransaction({name: 'saveAlertRule'});
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
        query: {
          duplicateRule: this.isDuplicateRule ? 'true' : 'false',
          wizardV3: 'true',
        },
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

    const {organization} = this.props;
    const {project} = this.state;
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

      const newTypeList = prevState.rule ? [...prevState.rule[type]] : [];
      newTypeList.splice(idx, 1);

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

    return (
      <StyledField
        label={null}
        help={null}
        error={detailedError?.name?.[0]}
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
      <StyledField
        extraMargin
        label={null}
        help={null}
        disabled={disabled}
        flexibleControlStateSize
      >
        <TeamSelector
          value={this.getTeamId()}
          project={project}
          onChange={this.handleOwnerChange}
          teamFilter={(team: Team) => team.isMember || team.id === ownerId}
          useId
          includeUnassigned
          disabled={disabled}
        />
      </StyledField>
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
        {({onChange, onBlur}) => (
          <SelectControl
            clearable={false}
            disabled={disabled}
            value={environment}
            options={environmentOptions}
            onChange={({value}) => {
              this.handleEnvironmentChange(value);
              onChange(value, {});
              onBlur(value, {});
            }}
          />
        )}
      </FormField>
    );
  }

  renderPreviewText() {
    const {issueCount, previewError} = this.state;
    if (previewError) {
      return t(
        "Select a condition above to see which issues would've triggered this alert"
      );
    }
    return tct(
      "[issueCount] issues would have triggered this rule in the past 14 days approximately. If you're looking to reduce noise then make sure to [link:read the docs].",
      {
        issueCount,
        link: <a href={SENTRY_ISSUE_ALERT_DOCS_URL} />,
      }
    );
  }

  renderPreviewTable() {
    const {members} = this.props;
    const {
      previewGroups,
      previewError,
      pageLinks,
      issueCount,
      previewPage,
      loadingPreview,
    } = this.state;
    return (
      <PreviewTable
        previewGroups={previewGroups}
        members={members}
        pageLinks={pageLinks}
        onCursor={this.onPreviewCursor}
        issueCount={issueCount}
        page={previewPage}
        loading={loadingPreview}
        error={previewError}
      />
    );
  }

  renderProjectSelect(disabled: boolean) {
    const {project: _selectedProject, projects, organization} = this.props;
    const {rule} = this.state;
    const hasOpenMembership = organization.features.includes('open-membership');
    const myProjects = projects.filter(project => project.hasAccess && project.isMember);
    const allProjects = projects.filter(
      project => project.hasAccess && !project.isMember
    );

    const myProjectOptions = myProjects.map(myProject => ({
      value: myProject.id,
      label: myProject.slug,
      leadingItems: this.renderIdBadge(myProject),
    }));

    const openMembershipProjects = [
      {
        label: t('My Projects'),
        options: myProjectOptions,
      },
      {
        label: t('All Projects'),
        options: allProjects.map(allProject => ({
          value: allProject.id,
          label: allProject.slug,
          leadingItems: this.renderIdBadge(allProject),
        })),
      },
    ];

    const projectOptions =
      hasOpenMembership || isActiveSuperuser()
        ? openMembershipProjects
        : myProjectOptions;

    return (
      <FormField
        name="projectId"
        inline={false}
        style={{padding: 0}}
        flexibleControlStateSize
      >
        {({onChange, onBlur, model}) => {
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
                  this.handleOwnerChange({value: nextSelectedProject.teams[0].id});
                }

                this.setState({project: nextSelectedProject});

                onChange(value, {});
                onBlur(value, {});
              }}
              components={{
                SingleValue: containerProps => (
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
        {({onChange, onBlur}) => (
          <SelectControl
            clearable={false}
            disabled={disabled}
            value={`${frequency}`}
            options={FREQUENCY_OPTIONS}
            onChange={({value}) => {
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
    const {organization} = this.props;
    const {
      project,
      rule,
      detailedError,
      loading,
      ownership,
      sendingNotification,
      incompatibleCondition,
      incompatibleFilter,
    } = this.state;
    const {actions, filters, conditions, frequency} = rule || {};

    const environment =
      !rule || !rule.environment ? ALL_ENVIRONMENTS_KEY : rule.environment;

    // Note `key` on `<Form>` below is so that on initial load, we show
    // the form with a loading mask on top of it, but force a re-render by using
    // a different key when we have fetched the rule so that form inputs are filled in
    return (
      <Access access={['alerts:write']}>
        {({hasAccess}) => {
          // check if superuser or if user is on the alert's team
          const disabled = loading || !(isActiveSuperuser() || hasAccess);

          return (
            <Main fullWidth>
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
                  disabled ||
                  incompatibleCondition !== null ||
                  incompatibleFilter !== null
                }
                submitLabel={t('Save Rule')}
                extraButton={
                  isSavedAlertRule(rule) ? (
                    <Confirm
                      disabled={disabled}
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
                  {loading && <SemiTransparentLoadingMask data-test-id="loading-mask" />}
                  <StyledListItem>{t('Add alert settings')}</StyledListItem>
                  <SettingsContainer>
                    {this.renderEnvironmentSelect(disabled)}
                    {this.renderProjectSelect(disabled)}
                  </SettingsContainer>
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
                                          control: provided => ({
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
                                        onChange={val =>
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
                                    {detailedError?.conditions[0]}
                                  </StyledAlert>
                                )
                              }
                              incompatibleRule={incompatibleCondition}
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

                          <StepContent>
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
                                        control: provided => ({
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
                                      onChange={val =>
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
                                    {detailedError?.filters[0]}
                                  </StyledAlert>
                                )
                              }
                              incompatibleRule={incompatibleFilter}
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
                              ownership={ownership}
                              error={
                                this.hasError('actions') && (
                                  <StyledAlert type="error">
                                    {detailedError?.actions[0]}
                                  </StyledAlert>
                                )
                              }
                            />
                            <Feature
                              organization={organization}
                              features={['issue-alert-test-notifications']}
                            >
                              <TestButtonWrapper>
                                <Button
                                  type="button"
                                  onClick={this.testNotifications}
                                  disabled={
                                    sendingNotification ||
                                    rule?.actions === undefined ||
                                    rule?.actions.length === 0
                                  }
                                >
                                  {t('Test Notifications')}
                                </Button>
                              </TestButtonWrapper>
                            </Feature>
                          </StepContent>
                        </StepContainer>
                      </Step>
                    </PanelBody>
                  </ConditionsPanel>
                  <StyledListItem>
                    {t('Set action interval')}
                    <StyledFieldHelp>
                      {t('Perform the actions above once this often for an issue')}
                    </StyledFieldHelp>
                  </StyledListItem>
                  {this.renderActionInterval(disabled)}
                  <Feature organization={organization} features={['issue-alert-preview']}>
                    <StyledListItem>
                      <StyledListItemSpaced>
                        <div>
                          {t('Preview')}
                          <StyledFieldHelp>{this.renderPreviewText()}</StyledFieldHelp>
                        </div>
                      </StyledListItemSpaced>
                    </StyledListItem>
                    {this.renderPreviewTable()}
                  </Feature>
                  <StyledListItem>{t('Establish ownership')}</StyledListItem>
                  {this.renderRuleName(disabled)}
                  {this.renderTeamSelect(disabled)}
                </List>
              </StyledForm>
            </Main>
          );
        }}
      </Access>
    );
  }
}

export default withOrganization(withProjects(IssueRuleEditor));

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

const StyledListItemSpaced = styled('div')`
  display: flex;
  justify-content: space-between;
`;

const StyledFieldHelp = styled(FieldHelp)`
  margin-top: 0;
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
  & > span {
    display: flex;
    align-items: center;
    gap: ${space(0.5)};
  }
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
  font-weight: 600;
  line-height: 1.5;
`;

const EmbeddedWrapper = styled('div')`
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

const SettingsContainer = styled('div')`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: ${space(1)};
`;

const StyledField = styled(Field)<{extraMargin?: boolean}>`
  :last-child {
    padding-bottom: ${space(2)};
  }

  border-bottom: none;
  padding: 0;

  & > div {
    padding: 0;
    width: 100%;
  }

  margin-bottom: ${p => `${p.extraMargin ? '60px' : space(1)}`};
`;

const Main = styled(Layout.Main)`
  padding: ${space(2)} ${space(4)};
`;
