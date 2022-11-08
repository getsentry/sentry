import {Fragment, ReactNode} from 'react';
import {PlainRoute, RouteComponentProps} from 'react-router';
import styled from '@emotion/styled';

import {
  addErrorMessage,
  addSuccessMessage,
  clearIndicators,
  Indicator,
} from 'sentry/actionCreators/indicator';
import {fetchOrganizationTags} from 'sentry/actionCreators/tags';
import Access from 'sentry/components/acl/access';
import AsyncComponent from 'sentry/components/asyncComponent';
import Button from 'sentry/components/button';
import {HeaderTitleLegend} from 'sentry/components/charts/styles';
import CircleIndicator from 'sentry/components/circleIndicator';
import Confirm from 'sentry/components/confirm';
import Form, {FormProps} from 'sentry/components/forms/form';
import FormModel from 'sentry/components/forms/model';
import * as Layout from 'sentry/components/layouts/thirds';
import List from 'sentry/components/list';
import ListItem from 'sentry/components/list/listItem';
import {t} from 'sentry/locale';
import IndicatorStore from 'sentry/stores/indicatorStore';
import space from 'sentry/styles/space';
import {EventsStats, MultiSeriesEventsStats, Organization, Project} from 'sentry/types';
import {defined} from 'sentry/utils';
import {metric} from 'sentry/utils/analytics';
import trackAdvancedAnalyticsEvent from 'sentry/utils/analytics/trackAdvancedAnalyticsEvent';
import type EventView from 'sentry/utils/discover/eventView';
import {isActiveSuperuser} from 'sentry/utils/isActiveSuperuser';
import withProjects from 'sentry/utils/withProjects';
import {IncompatibleAlertQuery} from 'sentry/views/alerts/rules/metric/incompatibleAlertQuery';
import RuleNameOwnerForm from 'sentry/views/alerts/rules/metric/ruleNameOwnerForm';
import ThresholdTypeForm from 'sentry/views/alerts/rules/metric/thresholdTypeForm';
import Triggers from 'sentry/views/alerts/rules/metric/triggers';
import TriggersChart from 'sentry/views/alerts/rules/metric/triggers/chart';
import {getEventTypeFilter} from 'sentry/views/alerts/rules/metric/utils/getEventTypeFilter';
import hasThresholdValue from 'sentry/views/alerts/rules/metric/utils/hasThresholdValue';
import {AlertRuleType} from 'sentry/views/alerts/types';
import {
  AlertWizardAlertNames,
  DatasetMEPAlertQueryTypes,
} from 'sentry/views/alerts/wizard/options';
import {getAlertTypeFromAggregateDataset} from 'sentry/views/alerts/wizard/utils';

import {isCrashFreeAlert} from './utils/isCrashFreeAlert';
import {addOrUpdateRule} from './actions';
import {
  createDefaultTrigger,
  DEFAULT_CHANGE_COMP_DELTA,
  DEFAULT_CHANGE_TIME_WINDOW,
  DEFAULT_COUNT_TIME_WINDOW,
} from './constants';
import RuleConditionsForm from './ruleConditionsForm';
import {
  AlertRuleComparisonType,
  AlertRuleThresholdType,
  AlertRuleTriggerType,
  Dataset,
  EventTypes,
  MetricActionTemplate,
  MetricRule,
  Trigger,
  UnsavedMetricRule,
} from './types';

const POLLING_MAX_TIME_LIMIT = 3 * 60000;

type RuleTaskResponse = {
  status: 'pending' | 'failed' | 'success';
  alertRule?: MetricRule;
  error?: string;
};

type Props = {
  organization: Organization;
  project: Project;
  projects: Project[];
  routes: PlainRoute[];
  rule: MetricRule;
  userTeamIds: string[];
  disableProjectSelector?: boolean;
  eventView?: EventView;
  isCustomMetric?: boolean;
  isDuplicateRule?: boolean;
  ruleId?: string;
  sessionId?: string;
} & RouteComponentProps<{orgId: string; projectId?: string; ruleId?: string}, {}> & {
    onSubmitSuccess?: FormProps['onSubmitSuccess'];
  } & AsyncComponent['props'];

type State = {
  aggregate: string;
  // `null` means loading
  availableActions: MetricActionTemplate[] | null;
  comparisonType: AlertRuleComparisonType;
  // Rule conditions form inputs
  // Needed for TriggersChart
  dataset: Dataset;
  environment: string | null;
  eventTypes: EventTypes[];
  project: Project;
  query: string;
  resolveThreshold: UnsavedMetricRule['resolveThreshold'];
  showMEPAlertBanner: boolean;
  thresholdPeriod: UnsavedMetricRule['thresholdPeriod'];
  thresholdType: UnsavedMetricRule['thresholdType'];
  timeWindow: number;
  triggerErrors: Map<number, {[fieldName: string]: string}>;
  triggers: Trigger[];
  comparisonDelta?: number;
  uuid?: string;
} & AsyncComponent['state'];

const isEmpty = (str: unknown): boolean => str === '' || !defined(str);

class RuleFormContainer extends AsyncComponent<Props, State> {
  form = new FormModel();
  pollingTimeout: number | undefined = undefined;

  get isDuplicateRule(): boolean {
    return Boolean(this.props.isDuplicateRule);
  }

  get chartQuery(): string {
    const {query, eventTypes, dataset} = this.state;
    const eventTypeFilter = getEventTypeFilter(this.state.dataset, eventTypes);
    const queryWithTypeFilter = `${query} ${eventTypeFilter}`.trim();
    return isCrashFreeAlert(dataset) ? query : queryWithTypeFilter;
  }

  componentDidMount() {
    const {organization} = this.props;
    const {project} = this.state;
    // SearchBar gets its tags from Reflux.
    fetchOrganizationTags(this.api, organization.slug, [project.id]);
  }

  componentWillUnmount() {
    window.clearTimeout(this.pollingTimeout);
  }

  getDefaultState(): State {
    const {rule, location} = this.props;
    const triggersClone = [...rule.triggers];
    const {
      aggregate,
      eventTypes: _eventTypes,
      dataset,
      name,
      showMEPAlertBanner,
    } = location?.query ?? {};
    const eventTypes = typeof _eventTypes === 'string' ? [_eventTypes] : _eventTypes;

    // Warning trigger is removed if it is blank when saving
    if (triggersClone.length !== 2) {
      triggersClone.push(createDefaultTrigger(AlertRuleTriggerType.WARNING));
    }

    return {
      ...super.getDefaultState(),

      name: name ?? rule.name ?? '',
      aggregate: aggregate ?? rule.aggregate,
      dataset: dataset ?? rule.dataset,
      eventTypes: eventTypes ?? rule.eventTypes ?? [],
      query: rule.query ?? '',
      timeWindow: rule.timeWindow,
      environment: rule.environment || null,
      triggerErrors: new Map(),
      availableActions: null,
      triggers: triggersClone,
      resolveThreshold: rule.resolveThreshold,
      thresholdType: rule.thresholdType,
      thresholdPeriod: rule.thresholdPeriod ?? 1,
      comparisonDelta: rule.comparisonDelta ?? undefined,
      comparisonType: rule.comparisonDelta
        ? AlertRuleComparisonType.CHANGE
        : AlertRuleComparisonType.COUNT,
      project: this.props.project,
      owner: rule.owner,
      showMEPAlertBanner: showMEPAlertBanner ?? false,
    };
  }

  getEndpoints(): ReturnType<AsyncComponent['getEndpoints']> {
    const {orgId} = this.props.params;

    // TODO(incidents): This is temporary until new API endpoints
    // We should be able to just fetch the rule if rule.id exists

    return [
      ['availableActions', `/organizations/${orgId}/alert-rules/available-actions/`],
    ];
  }

  goBack() {
    const {router} = this.props;
    const {orgId} = this.props.params;

    router.push(`/organizations/${orgId}/alerts/rules/`);
  }

  resetPollingState = (loadingSlackIndicator: Indicator) => {
    IndicatorStore.remove(loadingSlackIndicator);
    this.setState({loading: false, uuid: undefined});
  };

  fetchStatus(model: FormModel) {
    const loadingSlackIndicator = IndicatorStore.addMessage(
      t('Looking for your slack channel (this can take a while)'),
      'loading'
    );
    // pollHandler calls itself until it gets either a success
    // or failed status but we don't want to poll forever so we pass
    // in a hard stop time of 3 minutes before we bail.
    const quitTime = Date.now() + POLLING_MAX_TIME_LIMIT;
    window.clearTimeout(this.pollingTimeout);
    this.pollingTimeout = window.setTimeout(() => {
      this.pollHandler(model, quitTime, loadingSlackIndicator);
    }, 1000);
  }

  pollHandler = async (
    model: FormModel,
    quitTime: number,
    loadingSlackIndicator: Indicator
  ) => {
    if (Date.now() > quitTime) {
      addErrorMessage(t('Looking for that channel took too long :('));
      this.resetPollingState(loadingSlackIndicator);
      return;
    }

    const {
      organization,
      onSubmitSuccess,
      params: {ruleId},
    } = this.props;
    const {uuid, project} = this.state;

    try {
      const response: RuleTaskResponse = await this.api.requestPromise(
        `/projects/${organization.slug}/${project.slug}/alert-rule-task/${uuid}/`
      );

      const {status, alertRule, error} = response;

      if (status === 'pending') {
        window.clearTimeout(this.pollingTimeout);

        this.pollingTimeout = window.setTimeout(() => {
          this.pollHandler(model, quitTime, loadingSlackIndicator);
        }, 1000);
        return;
      }

      this.resetPollingState(loadingSlackIndicator);

      if (status === 'failed') {
        this.handleRuleSaveFailure(error);
      }
      if (alertRule) {
        addSuccessMessage(ruleId ? t('Updated alert rule') : t('Created alert rule'));
        if (onSubmitSuccess) {
          onSubmitSuccess(alertRule, model);
        }
      }
    } catch {
      this.handleRuleSaveFailure(t('An error occurred'));
      this.resetPollingState(loadingSlackIndicator);
    }
  };

  /**
   * Checks to see if threshold is valid given target value, and state of
   * inverted threshold as well as the *other* threshold
   *
   * @param type The threshold type to be updated
   * @param value The new threshold value
   */
  isValidTrigger = (
    triggerIndex: number,
    trigger: Trigger,
    errors,
    resolveThreshold: number | '' | null
  ): boolean => {
    const {alertThreshold} = trigger;
    const {thresholdType} = this.state;

    // If value and/or other value is empty
    // then there are no checks to perform against
    if (!hasThresholdValue(alertThreshold) || !hasThresholdValue(resolveThreshold)) {
      return true;
    }

    // If this is alert threshold and not inverted, it can't be below resolve
    // If this is alert threshold and inverted, it can't be above resolve
    // If this is resolve threshold and not inverted, it can't be above resolve
    // If this is resolve threshold and inverted, it can't be below resolve
    // Since we're comparing non-inclusive thresholds here (>, <), we need
    // to modify the values when we compare. An example of why:
    // Alert > 0, resolve < 1. This means that we want to alert on values
    // of 1 or more, and resolve on values of 0 or less. This is valid, but
    // without modifying the values, this boundary case will fail.
    const isValid =
      thresholdType === AlertRuleThresholdType.BELOW
        ? alertThreshold - 1 < resolveThreshold + 1
        : alertThreshold + 1 > resolveThreshold - 1;

    const otherErrors = errors.get(triggerIndex) || {};

    if (isValid) {
      return true;
    }

    // Not valid... let's figure out an error message
    const isBelow = thresholdType === AlertRuleThresholdType.BELOW;
    let errorMessage = '';

    if (typeof resolveThreshold !== 'number') {
      errorMessage = isBelow
        ? t('Resolution threshold must be greater than alert')
        : t('Resolution threshold must be less than alert');
    } else {
      errorMessage = isBelow
        ? t('Alert threshold must be less than resolution')
        : t('Alert threshold must be greater than resolution');
    }

    errors.set(triggerIndex, {
      ...otherErrors,
      alertThreshold: errorMessage,
    });

    return false;
  };

  validateFieldInTrigger({errors, triggerIndex, field, message, isValid}) {
    // If valid, reset error for fieldName
    if (isValid()) {
      const {[field]: _validatedField, ...otherErrors} = errors.get(triggerIndex) || {};

      if (Object.keys(otherErrors).length > 0) {
        errors.set(triggerIndex, otherErrors);
      } else {
        errors.delete(triggerIndex);
      }

      return errors;
    }

    if (!errors.has(triggerIndex)) {
      errors.set(triggerIndex, {});
    }
    const currentErrors = errors.get(triggerIndex);

    errors.set(triggerIndex, {
      ...currentErrors,
      [field]: message,
    });

    return errors;
  }

  /**
   * Validate triggers
   *
   * @return Returns true if triggers are valid
   */
  validateTriggers(
    triggers = this.state.triggers,
    thresholdType = this.state.thresholdType,
    resolveThreshold = this.state.resolveThreshold,
    changedTriggerIndex?: number
  ) {
    const {comparisonType} = this.state;
    const triggerErrors = new Map();

    const requiredFields = ['label', 'alertThreshold'];
    triggers.forEach((trigger, triggerIndex) => {
      requiredFields.forEach(field => {
        // check required fields
        this.validateFieldInTrigger({
          errors: triggerErrors,
          triggerIndex,
          isValid: (): boolean => {
            if (trigger.label === AlertRuleTriggerType.CRITICAL) {
              return !isEmpty(trigger[field]);
            }

            // If warning trigger has actions, it must have a value
            return trigger.actions.length === 0 || !isEmpty(trigger[field]);
          },
          field,
          message: t('Field is required'),
        });
      });

      // Check thresholds
      this.isValidTrigger(
        changedTriggerIndex ?? triggerIndex,
        trigger,
        triggerErrors,
        resolveThreshold
      );
    });

    // If we have 2 triggers, we need to make sure that the critical and warning
    // alert thresholds are valid (e.g. if critical is above x, warning must be less than x)
    const criticalTriggerIndex = triggers.findIndex(
      ({label}) => label === AlertRuleTriggerType.CRITICAL
    );
    const warningTriggerIndex = criticalTriggerIndex ^ 1;
    const criticalTrigger = triggers[criticalTriggerIndex];
    const warningTrigger = triggers[warningTriggerIndex];

    const isEmptyWarningThreshold = isEmpty(warningTrigger.alertThreshold);
    const warningThreshold = warningTrigger.alertThreshold ?? 0;
    const criticalThreshold = criticalTrigger.alertThreshold ?? 0;

    const hasError =
      thresholdType === AlertRuleThresholdType.ABOVE ||
      comparisonType === AlertRuleComparisonType.CHANGE
        ? warningThreshold > criticalThreshold
        : warningThreshold < criticalThreshold;

    if (hasError && !isEmptyWarningThreshold) {
      [criticalTriggerIndex, warningTriggerIndex].forEach(index => {
        const otherErrors = triggerErrors.get(index) ?? {};
        triggerErrors.set(index, {
          ...otherErrors,
          alertThreshold:
            thresholdType === AlertRuleThresholdType.ABOVE ||
            comparisonType === AlertRuleComparisonType.CHANGE
              ? t('Warning threshold must be less than critical threshold')
              : t('Warning threshold must be greater than critical threshold'),
        });
      });
    }

    return triggerErrors;
  }

  handleFieldChange = (name: string, value: unknown) => {
    const {projects} = this.props;
    if (
      [
        'aggregate',
        'dataset',
        'eventTypes',
        'timeWindow',
        'environment',
        'comparisonDelta',
        'projectId',
      ].includes(name)
    ) {
      this.setState(({project: _project}) => ({
        [name]: value,
        project: name === 'projectId' ? projects.find(({id}) => id === value) : _project,
      }));
    }
  };

  // We handle the filter update outside of the fieldChange handler since we
  // don't want to update the filter on every input change, just on blurs and
  // searches.
  handleFilterUpdate = (query: string) => {
    const {organization, sessionId} = this.props;

    trackAdvancedAnalyticsEvent('alert_builder.filter', {
      organization,
      session_id: sessionId,
      query,
    });

    this.setState({query});
  };

  handleSubmit = async (
    _data: Partial<MetricRule>,
    _onSubmitSuccess,
    _onSubmitError,
    _e,
    model: FormModel
  ) => {
    // This validates all fields *except* for Triggers
    const validRule = model.validateForm();

    // Validate Triggers
    const triggerErrors = this.validateTriggers();
    const validTriggers = Array.from(triggerErrors).length === 0;

    if (!validTriggers) {
      this.setState(state => ({
        triggerErrors: new Map([...triggerErrors, ...state.triggerErrors]),
      }));
    }

    if (!validRule || !validTriggers) {
      const missingFields = [
        !validRule && t('name'),
        !validRule && !validTriggers && t('and'),
        !validTriggers && t('critical threshold'),
      ].filter(x => x);

      addErrorMessage(t('Alert not valid: missing %s', missingFields.join(' ')));
      return;
    }

    const {
      organization,
      rule,
      onSubmitSuccess,
      location,
      sessionId,
      params: {ruleId},
    } = this.props;
    const {
      project,
      aggregate,
      dataset,
      resolveThreshold,
      triggers,
      thresholdType,
      thresholdPeriod,
      comparisonDelta,
      uuid,
      timeWindow,
      eventTypes,
    } = this.state;
    // Remove empty warning trigger
    const sanitizedTriggers = triggers.filter(
      trigger =>
        trigger.label !== AlertRuleTriggerType.WARNING || !isEmpty(trigger.alertThreshold)
    );

    // form model has all form state data, however we use local state to keep
    // track of the list of triggers (and actions within triggers)
    const loadingIndicator = IndicatorStore.addMessage(
      t('Saving your alert rule, hold on...'),
      'loading'
    );
    try {
      const transaction = metric.startTransaction({name: 'saveAlertRule'});
      transaction.setTag('type', AlertRuleType.METRIC);
      transaction.setTag('operation', !rule.id ? 'create' : 'edit');
      for (const trigger of sanitizedTriggers) {
        for (const action of trigger.actions) {
          if (action.type === 'slack') {
            transaction.setTag(action.type, true);
          }
        }
      }
      transaction.setData('actions', sanitizedTriggers);

      const hasMetricDataset =
        organization.features.includes('metrics-performance-alerts') ||
        organization.features.includes('mep-rollout-flag');

      this.setState({loading: true});
      const [data, , resp] = await addOrUpdateRule(
        this.api,
        organization.slug,
        project.slug,
        {
          ...rule,
          ...model.getTransformedData(),
          triggers: sanitizedTriggers,
          resolveThreshold: isEmpty(resolveThreshold) ? null : resolveThreshold,
          thresholdType,
          thresholdPeriod,
          comparisonDelta: comparisonDelta ?? null,
          timeWindow,
          aggregate,
          ...(hasMetricDataset ? {queryType: DatasetMEPAlertQueryTypes[dataset]} : {}),
          // Remove eventTypes as it is no longer requred for crash free
          eventTypes: isCrashFreeAlert(rule.dataset) ? undefined : eventTypes,
          dataset,
        },
        {
          duplicateRule: this.isDuplicateRule ? 'true' : 'false',
          wizardV3: 'true',
          referrer: location?.query?.referrer,
          sessionId,
        }
      );
      // if we get a 202 back it means that we have an async task
      // running to lookup and verify the channel id for Slack.
      if (resp?.status === 202) {
        // if we have a uuid in state, no need to start a new polling cycle
        if (!uuid) {
          this.setState({loading: true, uuid: data.uuid});
          this.fetchStatus(model);
        }
      } else {
        IndicatorStore.remove(loadingIndicator);
        this.setState({loading: false});
        addSuccessMessage(ruleId ? t('Updated alert rule') : t('Created alert rule'));
        if (onSubmitSuccess) {
          onSubmitSuccess(data, model);
        }
      }
    } catch (err) {
      IndicatorStore.remove(loadingIndicator);
      this.setState({loading: false});
      const errors = err?.responseJSON
        ? Array.isArray(err?.responseJSON)
          ? err?.responseJSON
          : Object.values(err?.responseJSON)
        : [];
      const apiErrors = errors.length > 0 ? `: ${errors.join(', ')}` : '';
      this.handleRuleSaveFailure(t('Unable to save alert%s', apiErrors));
    }
  };

  /**
   * Callback for when triggers change
   *
   * Re-validate triggers on every change and reset indicators when no errors
   */
  handleChangeTriggers = (triggers: Trigger[], triggerIndex?: number) => {
    this.setState(state => {
      let triggerErrors = state.triggerErrors;

      const newTriggerErrors = this.validateTriggers(
        triggers,
        state.thresholdType,
        state.resolveThreshold,
        triggerIndex
      );
      triggerErrors = newTriggerErrors;

      if (Array.from(newTriggerErrors).length === 0) {
        clearIndicators();
      }

      return {triggers, triggerErrors};
    });
  };

  handleThresholdTypeChange = (thresholdType: AlertRuleThresholdType) => {
    const {triggers} = this.state;

    const triggerErrors = this.validateTriggers(triggers, thresholdType);
    this.setState(state => ({
      thresholdType,
      triggerErrors: new Map([...triggerErrors, ...state.triggerErrors]),
    }));
  };

  handleThresholdPeriodChange = (value: number) => {
    this.setState({thresholdPeriod: value});
  };

  handleResolveThresholdChange = (
    resolveThreshold: UnsavedMetricRule['resolveThreshold']
  ) => {
    this.setState(state => {
      const triggerErrors = this.validateTriggers(
        state.triggers,
        state.thresholdType,
        resolveThreshold
      );
      if (Array.from(triggerErrors).length === 0) {
        clearIndicators();
      }

      return {resolveThreshold, triggerErrors};
    });
  };

  handleComparisonTypeChange = (value: AlertRuleComparisonType) => {
    const comparisonDelta =
      value === AlertRuleComparisonType.COUNT
        ? undefined
        : this.state.comparisonDelta ?? DEFAULT_CHANGE_COMP_DELTA;
    const timeWindow = this.state.comparisonDelta
      ? DEFAULT_COUNT_TIME_WINDOW
      : DEFAULT_CHANGE_TIME_WINDOW;
    this.setState({comparisonType: value, comparisonDelta, timeWindow});
  };

  handleDeleteRule = async () => {
    const {params} = this.props;
    const {orgId, projectId, ruleId} = params;

    try {
      await this.api.requestPromise(
        `/projects/${orgId}/${projectId}/alert-rules/${ruleId}/`,
        {
          method: 'DELETE',
        }
      );
      this.goBack();
    } catch (_err) {
      addErrorMessage(t('Error deleting rule'));
    }
  };

  handleRuleSaveFailure = (msg: ReactNode) => {
    addErrorMessage(msg);
    metric.endTransaction({name: 'saveAlertRule'});
  };

  handleCancel = () => {
    this.goBack();
  };

  handleMEPAlertDataset = (data: EventsStats | MultiSeriesEventsStats | null) => {
    const {isMetricsData} = data ?? {};

    if (
      isMetricsData === undefined ||
      !this.props.organization.features.includes('metrics-performance-alerts')
    ) {
      return;
    }

    const {dataset, showMEPAlertBanner} = this.state;

    if (isMetricsData && dataset === Dataset.TRANSACTIONS) {
      this.setState({dataset: Dataset.GENERIC_METRICS, showMEPAlertBanner: false});
    }

    if (!isMetricsData && dataset === Dataset.GENERIC_METRICS && !showMEPAlertBanner) {
      this.setState({dataset: Dataset.TRANSACTIONS, showMEPAlertBanner: true});
    }
  };

  renderLoading() {
    return this.renderBody();
  }

  renderBody() {
    const {
      organization,
      ruleId,
      rule,
      onSubmitSuccess,
      router,
      disableProjectSelector,
      eventView,
      location,
    } = this.props;
    const {
      name,
      query,
      project,
      timeWindow,
      triggers,
      aggregate,
      environment,
      thresholdType,
      thresholdPeriod,
      comparisonDelta,
      comparisonType,
      resolveThreshold,
      loading,
      eventTypes,
      dataset,
      showMEPAlertBanner,
    } = this.state;

    const chartProps = {
      organization,
      projects: [project],
      triggers,
      location,
      query: this.chartQuery,
      aggregate,
      dataset,
      newAlertOrQuery: !ruleId || query !== rule.query,
      handleMEPAlertDataset: this.handleMEPAlertDataset,
      timeWindow,
      environment,
      resolveThreshold,
      thresholdType,
      comparisonDelta,
      comparisonType,
    };
    const alertType = getAlertTypeFromAggregateDataset({aggregate, dataset});

    const wizardBuilderChart = (
      <TriggersChart
        {...chartProps}
        header={
          <ChartHeader>
            <AlertName>{AlertWizardAlertNames[alertType]}</AlertName>
            {!isCrashFreeAlert(dataset) && (
              <AlertInfo>
                <StyledCircleIndicator size={8} />
                <Aggregate>{aggregate}</Aggregate>
                event.type:{eventTypes?.join(',')}
              </AlertInfo>
            )}
          </ChartHeader>
        }
      />
    );

    const triggerForm = (disabled: boolean) => (
      <Triggers
        disabled={disabled}
        projects={[project]}
        errors={this.state.triggerErrors}
        triggers={triggers}
        aggregate={aggregate}
        resolveThreshold={resolveThreshold}
        thresholdPeriod={thresholdPeriod}
        thresholdType={thresholdType}
        comparisonType={comparisonType}
        currentProject={project.slug}
        organization={organization}
        availableActions={this.state.availableActions}
        onChange={this.handleChangeTriggers}
        onThresholdTypeChange={this.handleThresholdTypeChange}
        onThresholdPeriodChange={this.handleThresholdPeriodChange}
        onResolveThresholdChange={this.handleResolveThresholdChange}
      />
    );

    const ruleNameOwnerForm = (disabled: boolean) => (
      <RuleNameOwnerForm disabled={disabled} project={project} />
    );

    const thresholdTypeForm = (disabled: boolean) => (
      <ThresholdTypeForm
        comparisonType={comparisonType}
        dataset={dataset}
        disabled={disabled}
        onComparisonDeltaChange={value =>
          this.handleFieldChange('comparisonDelta', value)
        }
        onComparisonTypeChange={this.handleComparisonTypeChange}
        organization={organization}
        comparisonDelta={comparisonDelta}
      />
    );

    return (
      <Access access={['alerts:write']}>
        {({hasAccess}) => {
          const disabled = loading || !(isActiveSuperuser() || hasAccess);

          return (
            <Fragment>
              <Main fullWidth>
                {eventView && (
                  <IncompatibleAlertQuery
                    orgSlug={organization.slug}
                    eventView={eventView}
                  />
                )}
                <Form
                  model={this.form}
                  apiMethod={ruleId ? 'PUT' : 'POST'}
                  apiEndpoint={`/organizations/${organization.slug}/alert-rules/${
                    ruleId ? `${ruleId}/` : ''
                  }`}
                  submitDisabled={disabled}
                  initialData={{
                    name,
                    dataset,
                    eventTypes,
                    aggregate,
                    query,
                    timeWindow: rule.timeWindow,
                    environment: rule.environment || null,
                    owner: rule.owner,
                    projectId: project.id,
                  }}
                  saveOnBlur={false}
                  onSubmit={this.handleSubmit}
                  onSubmitSuccess={onSubmitSuccess}
                  onCancel={this.handleCancel}
                  onFieldChange={this.handleFieldChange}
                  extraButton={
                    rule.id ? (
                      <Confirm
                        disabled={disabled}
                        message={t('Are you sure you want to delete this alert rule?')}
                        header={t('Delete Alert Rule?')}
                        priority="danger"
                        confirmText={t('Delete Rule')}
                        onConfirm={this.handleDeleteRule}
                      >
                        <Button type="button" priority="danger">
                          {t('Delete Rule')}
                        </Button>
                      </Confirm>
                    ) : null
                  }
                  submitLabel={t('Save Rule')}
                >
                  <List symbol="colored-numeric">
                    <RuleConditionsForm
                      api={this.api}
                      project={project}
                      organization={organization}
                      router={router}
                      disabled={disabled}
                      thresholdChart={wizardBuilderChart}
                      onFilterSearch={this.handleFilterUpdate}
                      allowChangeEventTypes={
                        alertType === 'custom' || dataset === Dataset.ERRORS
                      }
                      alertType={alertType}
                      dataset={dataset}
                      timeWindow={timeWindow}
                      comparisonType={comparisonType}
                      comparisonDelta={comparisonDelta}
                      onComparisonDeltaChange={value =>
                        this.handleFieldChange('comparisonDelta', value)
                      }
                      onTimeWindowChange={value =>
                        this.handleFieldChange('timeWindow', value)
                      }
                      disableProjectSelector={disableProjectSelector}
                      showMEPAlertBanner={showMEPAlertBanner}
                    />
                    <AlertListItem>{t('Set thresholds')}</AlertListItem>
                    {thresholdTypeForm(disabled)}
                    {triggerForm(disabled)}
                    {ruleNameOwnerForm(disabled)}
                  </List>
                </Form>
              </Main>
            </Fragment>
          );
        }}
      </Access>
    );
  }
}

const Main = styled(Layout.Main)`
  padding: ${space(2)} ${space(4)};
`;

const StyledListItem = styled(ListItem)`
  margin: ${space(2)} 0 ${space(1)} 0;
  font-size: ${p => p.theme.fontSizeExtraLarge};
`;

const AlertListItem = styled(StyledListItem)`
  margin-top: 0;
`;

const ChartHeader = styled('div')`
  padding: ${space(2)} ${space(3)} 0 ${space(3)};
  margin-bottom: -${space(1.5)};
`;

const AlertName = styled(HeaderTitleLegend)`
  position: relative;
`;

const AlertInfo = styled('div')`
  font-size: ${p => p.theme.fontSizeSmall};
  font-family: ${p => p.theme.text.family};
  font-weight: normal;
  color: ${p => p.theme.textColor};
`;

const StyledCircleIndicator = styled(CircleIndicator)`
  background: ${p => p.theme.formText};
  height: ${space(1)};
  margin-right: ${space(0.5)};
`;

const Aggregate = styled('span')`
  margin-right: ${space(1)};
`;

export default withProjects(RuleFormContainer);
