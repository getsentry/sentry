import type {ComponentProps, ReactNode} from 'react';
import type {Theme} from '@emotion/react';
import styled from '@emotion/styled';
import * as Sentry from '@sentry/react';

import {ExternalLink} from '@sentry/scraps/link/link';
import {Tooltip, type TooltipProps} from '@sentry/scraps/tooltip/tooltip';

import type {Indicator} from 'sentry/actionCreators/indicator';
import {
  addErrorMessage,
  addSuccessMessage,
  clearIndicators,
} from 'sentry/actionCreators/indicator';
import {fetchOrganizationTags} from 'sentry/actionCreators/tags';
import {hasEveryAccess} from 'sentry/components/acl/access';
import {HeaderTitleLegend} from 'sentry/components/charts/styles';
import CircleIndicator from 'sentry/components/circleIndicator';
import Confirm from 'sentry/components/confirm';
import {Alert} from 'sentry/components/core/alert';
import {Button} from 'sentry/components/core/button';
import DeprecatedAsyncComponent from 'sentry/components/deprecatedAsyncComponent';
import type {FormProps} from 'sentry/components/forms/form';
import Form from 'sentry/components/forms/form';
import FormModel from 'sentry/components/forms/model';
import * as Layout from 'sentry/components/layouts/thirds';
import List from 'sentry/components/list';
import ListItem from 'sentry/components/list/listItem';
import {IconWarning} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import IndicatorStore from 'sentry/stores/indicatorStore';
import {pulse} from 'sentry/styles/animations';
import {space} from 'sentry/styles/space';
import type {PlainRoute, RouteComponentProps} from 'sentry/types/legacyReactRouter';
import type {
  Confidence,
  EventsStats,
  MultiSeriesEventsStats,
  Organization,
} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';
import {defined} from 'sentry/utils';
import {metric, trackAnalytics} from 'sentry/utils/analytics';
import type EventView from 'sentry/utils/discover/eventView';
import {parseFunction, prettifyParsedFunction} from 'sentry/utils/discover/fields';
import {AggregationKey} from 'sentry/utils/fields';
import {isOnDemandQueryString} from 'sentry/utils/onDemandMetrics';
import {
  hasOnDemandMetricAlertFeature,
  shouldShowOnDemandMetricAlertUI,
} from 'sentry/utils/onDemandMetrics/features';
import withProjects from 'sentry/utils/withProjects';
import {makeAlertsPathname} from 'sentry/views/alerts/pathnames';
import {getIsMigratedExtrapolationMode} from 'sentry/views/alerts/rules/metric/details/utils';
import {IncompatibleAlertQuery} from 'sentry/views/alerts/rules/metric/incompatibleAlertQuery';
import {OnDemandThresholdChecker} from 'sentry/views/alerts/rules/metric/onDemandThresholdChecker';
import RuleNameOwnerForm from 'sentry/views/alerts/rules/metric/ruleNameOwnerForm';
import ThresholdTypeForm from 'sentry/views/alerts/rules/metric/thresholdTypeForm';
import Triggers from 'sentry/views/alerts/rules/metric/triggers';
import TriggersChart, {ErrorChart} from 'sentry/views/alerts/rules/metric/triggers/chart';
import type {SeriesSamplingInfo} from 'sentry/views/alerts/rules/metric/utils/determineSeriesSampleCount';
import {determineSeriesSampleCountAndIsSampled} from 'sentry/views/alerts/rules/metric/utils/determineSeriesSampleCount';
import {getEventTypeFilter} from 'sentry/views/alerts/rules/metric/utils/getEventTypeFilter';
import hasThresholdValue from 'sentry/views/alerts/rules/metric/utils/hasThresholdValue';
import {isOnDemandMetricAlert} from 'sentry/views/alerts/rules/metric/utils/onDemandMetricAlert';
import {isEapAlertType} from 'sentry/views/alerts/rules/utils';
import {AlertRuleType, type Anomaly} from 'sentry/views/alerts/types';
import {ruleNeedsErrorMigration} from 'sentry/views/alerts/utils/migrationUi';
import type {MetricAlertType} from 'sentry/views/alerts/wizard/options';
import {
  AlertWizardAlertNames,
  DatasetMEPAlertQueryTypes,
} from 'sentry/views/alerts/wizard/options';
import {
  getAlertTypeFromAggregateDataset,
  getTraceItemTypeForDatasetAndEventType,
} from 'sentry/views/alerts/wizard/utils';
import {isEventsStats} from 'sentry/views/dashboards/utils/isEventsStats';
import type {TimeSeries} from 'sentry/views/dashboards/widgets/common/types';
import {combineConfidenceForSeries} from 'sentry/views/explore/utils';
import {convertEventsStatsToTimeSeriesData} from 'sentry/views/insights/common/queries/useSortedTimeSeries';
import {deprecateTransactionAlerts} from 'sentry/views/insights/common/utils/hasEAPAlerts';
import {ProjectPermissionAlert} from 'sentry/views/settings/project/projectPermissionAlert';

import {isCrashFreeAlert} from './utils/isCrashFreeAlert';
import {addOrUpdateRule} from './actions';
import {
  createDefaultTrigger,
  DEFAULT_CHANGE_COMP_DELTA,
  DEFAULT_CHANGE_TIME_WINDOW,
  DEFAULT_COUNT_TIME_WINDOW,
  DEFAULT_DYNAMIC_TIME_WINDOW,
  getTimeWindowOptions,
} from './constants';
import RuleConditionsForm from './ruleConditionsForm';
import {
  AlertRuleComparisonType,
  AlertRuleSeasonality,
  AlertRuleSensitivity,
  AlertRuleThresholdType,
  AlertRuleTriggerType,
  Dataset,
  ExtrapolationMode,
  TimeWindow,
  type EventTypes,
  type MetricActionTemplate,
  type MetricRule,
  type Trigger,
  type UnsavedMetricRule,
} from './types';

const POLLING_MAX_TIME_LIMIT = 3 * 60000;

type RuleTaskResponse = {
  status: 'pending' | 'failed' | 'success';
  alertRule?: MetricRule;
  error?: string;
};

type HistoricalDataset = ReturnType<typeof formatStatsToHistoricalDataset>;

type Props = {
  organization: Organization;
  project: Project;
  projects: Project[];
  routes: PlainRoute[];
  rule: MetricRule;
  theme: Theme;
  userTeamIds: string[];
  disableProjectSelector?: boolean;
  eventView?: EventView;
  isDuplicateRule?: boolean;
  ruleId?: string;
  sessionId?: string;
} & RouteComponentProps<{projectId?: string; ruleId?: string}> & {
    onSubmitSuccess?: FormProps['onSubmitSuccess'];
  } & DeprecatedAsyncComponent['props'];

type State = {
  aggregate: string;
  alertType: MetricAlertType;
  anomalies: Anomaly[];
  // `null` means loading
  availableActions: MetricActionTemplate[] | null;
  comparisonType: AlertRuleComparisonType;
  currentData: HistoricalDataset;
  // Rule conditions form inputs
  // Needed for TriggersChart
  dataset: Dataset;
  environment: string | null;
  eventTypes: EventTypes[];
  historicalData: HistoricalDataset;
  isQueryValid: boolean;
  project: Project;
  query: string;
  resolveThreshold: UnsavedMetricRule['resolveThreshold'];
  sensitivity: UnsavedMetricRule['sensitivity'];
  thresholdType: UnsavedMetricRule['thresholdType'];
  timeWindow: number;
  triggerErrors: Map<number, Record<string, string>>;
  triggers: Trigger[];
  chartError?: boolean;
  chartErrorMessage?: string;
  comparisonDelta?: number;
  confidence?: Confidence;
  extrapolationMode?: ExtrapolationMode;
  isExtrapolatedChartData?: boolean;
  seasonality?: AlertRuleSeasonality;
  seriesSamplingInfo?: SeriesSamplingInfo;
} & DeprecatedAsyncComponent['state'];

const isEmpty = (str: unknown): boolean => str === '' || !defined(str);

class RuleFormContainer extends DeprecatedAsyncComponent<Props, State> {
  form = new FormModel();
  pollingTimeout: number | undefined = undefined;
  uuid: string | null = null;

  constructor(props: any) {
    super(props);
    this.handleHistoricalTimeSeriesDataFetched =
      this.handleHistoricalTimeSeriesDataFetched.bind(this);
  }

  get isDuplicateRule(): boolean {
    return Boolean(this.props.isDuplicateRule);
  }

  get chartQuery(): string {
    const {alertType, query, eventTypes, dataset} = this.state;
    const eventTypeFilter = getEventTypeFilter(this.state.dataset, eventTypes);
    const queryWithTypeFilter = (
      isEapAlertType(alertType)
        ? query
        : query
          ? `(${query}) AND (${eventTypeFilter})`
          : eventTypeFilter
    ).trim();
    return isCrashFreeAlert(dataset) ? query : queryWithTypeFilter;
  }

  componentDidMount() {
    super.componentDidMount();
    const {organization} = this.props;
    const {project} = this.state;
    // SearchBar gets its tags from Reflux.
    fetchOrganizationTags(this.api, organization.slug, [project.id]);
  }

  componentWillUnmount() {
    window.clearTimeout(this.pollingTimeout);
  }

  getDefaultState(): State {
    const {rule, location, organization} = this.props;
    const triggersClone = [...rule.triggers];
    const {
      aggregate: _aggregate,
      eventTypes: _eventTypes,
      dataset: _dataset,
      name,
    } = location?.query ?? {};
    const eventTypes = typeof _eventTypes === 'string' ? [_eventTypes] : _eventTypes;

    // Warning trigger is removed if it is blank when saving
    if (triggersClone.length !== 2) {
      triggersClone.push(createDefaultTrigger(AlertRuleTriggerType.WARNING));
    }

    const aggregate = _aggregate ?? rule.aggregate;
    const dataset = _dataset ?? rule.dataset;

    const isErrorMigration =
      this.props.location?.query?.migration === '1' && ruleNeedsErrorMigration(rule);
    // TODO(issues): Does this need to be smarter about where its inserting the new filter?
    const query = isErrorMigration
      ? `is:unresolved ${rule.query ?? ''}`
      : (rule.query ?? '');

    const ruleEventTypes = eventTypes ?? rule.eventTypes ?? [];
    const traceItemType = getTraceItemTypeForDatasetAndEventType(dataset, ruleEventTypes);

    const alertType = getAlertTypeFromAggregateDataset({
      aggregate,
      dataset,
      eventTypes: ruleEventTypes,
      organization,
    });

    return {
      ...super.getDefaultState(),
      currentData: [],
      historicalData: [],
      anomalies: [],
      name: name ?? rule.name ?? '',
      aggregate,
      dataset,
      eventTypes: eventTypes ?? rule.eventTypes ?? [],
      query,
      isQueryValid: true, // Assume valid until input is changed
      timeWindow: rule.timeWindow,
      environment: rule.environment || null,
      triggerErrors: new Map(),
      availableActions: null,
      metricExtractionRules: null,
      triggers: triggersClone,
      resolveThreshold: rule.resolveThreshold,
      extrapolationMode: rule.extrapolationMode,
      sensitivity: rule.sensitivity ?? undefined,
      seasonality: rule.seasonality ?? undefined,
      thresholdType: rule.thresholdType,
      thresholdPeriod: rule.thresholdPeriod ?? 1,
      comparisonDelta: rule.comparisonDelta ?? undefined,
      comparisonType: rule.comparisonDelta
        ? AlertRuleComparisonType.CHANGE
        : rule.sensitivity
          ? AlertRuleComparisonType.DYNAMIC
          : AlertRuleComparisonType.COUNT,
      project: this.props.project,
      owner: rule.owner,
      alertType,
      traceItemType,
    };
  }

  getEndpoints(): ReturnType<DeprecatedAsyncComponent['getEndpoints']> {
    const {organization} = this.props;
    // TODO(incidents): This is temporary until new API endpoints
    // We should be able to just fetch the rule if rule.id exists

    return [
      [
        'availableActions',
        `/organizations/${organization.slug}/alert-rules/available-actions/`,
      ],
    ];
  }

  goBack() {
    const {router} = this.props;
    const {organization} = this.props;

    router.push(
      makeAlertsPathname({
        path: `/rules/`,
        organization,
      })
    );
  }

  resetPollingState = (loadingSlackIndicator: Indicator) => {
    IndicatorStore.remove(loadingSlackIndicator);
    this.uuid = null;
    this.setState({loading: false});
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
    const {project} = this.state;

    try {
      const response: RuleTaskResponse = await this.api.requestPromise(
        `/projects/${organization.slug}/${project.slug}/alert-rule-task/${this.uuid}/`
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

        if (!ruleId) {
          trackAnalytics('metric_alert_rule.created', {
            organization,
            aggregate: alertRule.aggregate,
            dataset: alertRule.dataset,
          });
        }

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
    errors: any,
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

    if (typeof resolveThreshold === 'number') {
      errorMessage = isBelow
        ? t('Alert threshold must be less than resolution')
        : t('Alert threshold must be greater than resolution');
    } else {
      errorMessage = isBelow
        ? t('Resolution threshold must be greater than alert')
        : t('Resolution threshold must be less than alert');
    }

    errors.set(triggerIndex, {
      ...otherErrors,
      alertThreshold: errorMessage,
    });

    return false;
  };

  validateFieldInTrigger({errors, triggerIndex, field, message, isValid}: any) {
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
    // If we have an anomaly detection alert, then we don't need to validate the thresholds, but we do need to set them to 0
    if (comparisonType === AlertRuleComparisonType.DYNAMIC) {
      // NOTE: we don't support warning triggers for anomaly detection alerts yet
      // once we do, uncomment this code and delete 475-478:
      // triggers.forEach(trigger => {
      //   trigger.alertThreshold = 0;
      // });
      const criticalTriggerIndex = triggers.findIndex(
        ({label}) => label === AlertRuleTriggerType.CRITICAL
      );
      const warningTriggerIndex = criticalTriggerIndex ^ 1;
      const triggersCopy = [...triggers];
      const criticalTrigger = triggersCopy[criticalTriggerIndex]!;
      const warningTrigger = triggersCopy[warningTriggerIndex]!;
      criticalTrigger.alertThreshold = 0;
      warningTrigger.alertThreshold = ''; // we need to set this to empty
      this.setState({triggers: triggersCopy});
      return triggerErrors; // return an empty map
    }
    const requiredFields = ['label', 'alertThreshold'];
    triggers.forEach((trigger, triggerIndex) => {
      requiredFields.forEach(field => {
        // check required fields
        this.validateFieldInTrigger({
          errors: triggerErrors,
          triggerIndex,
          isValid: (): boolean => {
            if (trigger.label === AlertRuleTriggerType.CRITICAL) {
              // @ts-expect-error TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
              return !isEmpty(trigger[field]);
            }

            // If warning trigger has actions, it must have a value
            // @ts-expect-error TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
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
    const criticalTrigger = triggers[criticalTriggerIndex]!;
    const warningTrigger = triggers[warningTriggerIndex]!;

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
    const {projects, organization} = this.props;
    const {timeWindow, chartError} = this.state;
    if (chartError) {
      this.setState({chartError: false, chartErrorMessage: undefined});
    }

    if (name === 'alertType') {
      if (value === 'crash_free_sessions' || value === 'crash_free_users') {
        this.setState({comparisonType: AlertRuleComparisonType.COUNT});
      }
      this.setState(({dataset}) => ({
        alertType: value as MetricAlertType,
        dataset: this.checkOnDemandMetricsDataset(dataset, this.state.query),
        timeWindow:
          isEapAlertType(value as MetricAlertType) && timeWindow === TimeWindow.ONE_MINUTE
            ? TimeWindow.FIVE_MINUTES
            : timeWindow,
      }));
      return;
    }

    if (name === 'projectId') {
      this.setState(
        ({project}) => {
          return {
            projectId: value,
            project: projects.find(({id}) => id === value) ?? project,
          };
        },
        () => {
          this.reloadData();
          fetchOrganizationTags(this.api, this.props.organization.slug, [
            this.state.project.id,
          ]);
        }
      );
    }

    if (
      [
        'aggregate',
        'dataset',
        'eventTypes',
        'timeWindow',
        'environment',
        'comparisonDelta',
        'alertType',
      ].includes(name)
    ) {
      this.setState(
        ({dataset: _dataset, aggregate, alertType, eventTypes: _eventTypes}) => {
          const dataset = this.checkOnDemandMetricsDataset(
            name === 'dataset' ? (value as Dataset) : _dataset,
            this.state.query
          );

          const eventTypes =
            name === 'eventTypes' ? (value as EventTypes[]) : _eventTypes;

          if (deprecateTransactionAlerts(organization)) {
            const newAlertType = getAlertTypeFromAggregateDataset({
              aggregate: name === 'aggregate' ? (value as string) : aggregate,
              dataset,
              organization,
              eventTypes,
            });

            return {
              [name]: value,
              alertType: newAlertType,
              dataset,
            };
          }

          const newAlertType = getAlertTypeFromAggregateDataset({
            aggregate,
            dataset,
            eventTypes,
            organization,
          });

          return {
            [name]: value,
            alertType: alertType === newAlertType ? alertType : 'custom_transactions',
            dataset,
          };
        }
      );
    }
  };

  // We handle the filter update outside of the fieldChange handler since we
  // don't want to update the filter on every input change, just on blurs and
  // searches.
  handleFilterUpdate = (query: string, isQueryValid: boolean) => {
    const {organization, sessionId} = this.props;

    trackAnalytics('alert_builder.filter', {
      organization,
      session_id: sessionId,
      query,
    });

    const dataset = this.checkOnDemandMetricsDataset(this.state.dataset, query);
    this.setState({query, dataset, isQueryValid});
  };

  validateOnDemandMetricAlert() {
    if (
      !isOnDemandMetricAlert(this.state.dataset, this.state.aggregate, this.state.query)
    ) {
      return true;
    }

    return !this.state.aggregate.includes(AggregationKey.PERCENTILE);
  }

  validateSubmit = (model: any) => {
    // This validates all fields *except* for Triggers
    const validRule = model.validateForm();

    // Validate Triggers
    const triggerErrors = this.validateTriggers();
    const validTriggers = Array.from(triggerErrors).length === 0;
    const validOnDemandAlert = this.validateOnDemandMetricAlert();

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
      return false;
    }

    if (!validOnDemandAlert) {
      addErrorMessage(
        t('%s is not supported for on-demand metric alerts', this.state.aggregate)
      );
      return false;
    }

    return true;
  };

  handleSubmit = async (
    _data: Partial<MetricRule>,
    _onSubmitSuccess: any,
    _onSubmitError: any,
    _e: any,
    model: FormModel
  ) => {
    if (!this.validateSubmit(model)) {
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
      resolveThreshold,
      triggers,
      thresholdType,
      thresholdPeriod,
      comparisonDelta,
      timeWindow,
      eventTypes,
      sensitivity,
      seasonality,
      comparisonType,
      extrapolationMode,
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
    await Sentry.withScope(async scope => {
      try {
        scope.setTag('type', AlertRuleType.METRIC);
        scope.setTag('operation', rule.id ? 'edit' : 'create');
        for (const trigger of sanitizedTriggers) {
          for (const action of trigger.actions) {
            if (action.type === 'slack' || action.type === 'discord') {
              scope.setTag(action.type, true);
            }
          }
        }
        scope.setExtra('actions', sanitizedTriggers);

        metric.startSpan({name: 'saveAlertRule'});

        const detectionTypes = new Map([
          [AlertRuleComparisonType.COUNT, 'static'],
          [AlertRuleComparisonType.CHANGE, 'percent'],
          [AlertRuleComparisonType.DYNAMIC, 'dynamic'],
        ]);
        const detectionType = detectionTypes.get(comparisonType) ?? '';
        const dataset = this.determinePerformanceDataset();
        this.setState({loading: true});
        const traceItemType = getTraceItemTypeForDatasetAndEventType(dataset, eventTypes);
        // Add or update is just the PUT/POST to the org alert-rules api
        // we're splatting the full rule in, then overwriting all the data?
        const [data, , resp] = await addOrUpdateRule(
          this.api,
          organization.slug,
          {
            ...rule, // existing rule
            ...model.getTransformedData(), // form data
            projects: [project.slug],
            triggers: sanitizedTriggers,
            resolveThreshold:
              isEmpty(resolveThreshold) ||
              detectionType === AlertRuleComparisonType.DYNAMIC
                ? null
                : resolveThreshold,
            thresholdType,
            thresholdPeriod,
            comparisonDelta: comparisonDelta ?? null,
            timeWindow,
            aggregate,
            // Remove eventTypes as it is no longer required for crash free
            eventTypes: isCrashFreeAlert(dataset) ? undefined : eventTypes,
            dataset,
            // @ts-expect-error TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
            queryType: DatasetMEPAlertQueryTypes[dataset],
            sensitivity: sensitivity ?? null,
            seasonality: seasonality ?? null,
            detectionType,
            // We want to change the extrapolation mode to sample weighted once a migrated alert rule is edited
            extrapolationMode: this.isDuplicateRule
              ? undefined
              : getIsMigratedExtrapolationMode(extrapolationMode, dataset, traceItemType)
                ? ExtrapolationMode.CLIENT_AND_SERVER_WEIGHTED
                : extrapolationMode,
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
          if (!this.uuid) {
            this.uuid = data.uuid;
            this.setState({loading: true});
            this.fetchStatus(model);
          }
        } else {
          IndicatorStore.remove(loadingIndicator);
          this.setState({loading: false});
          addSuccessMessage(ruleId ? t('Updated alert rule') : t('Created alert rule'));

          if (!ruleId) {
            trackAnalytics('metric_alert_rule.created', {
              organization,
              aggregate: data.aggregate,
              dataset: data.dataset,
            });
          }

          if (onSubmitSuccess) {
            onSubmitSuccess(data, model);
          }
        }
      } catch (err: any) {
        IndicatorStore.remove(loadingIndicator);
        this.setState({loading: false});
        const errors = err?.responseJSON
          ? Array.isArray(err?.responseJSON)
            ? err?.responseJSON
            : Object.values(err?.responseJSON)
          : [];
        let apiErrors = '';
        if (typeof errors[0] === 'object' && !Array.isArray(errors[0])) {
          // NOTE: this occurs if we get a TimeoutError when attempting to hit the Seer API
          apiErrors = ': ' + errors[0].message;
        } else {
          apiErrors = errors.length > 0 ? `: ${errors.join(', ')}` : '';
        }
        this.handleRuleSaveFailure(t('Unable to save alert%s', apiErrors));
      }
    });
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

      return {
        triggers,
        triggerErrors,
        triggersHaveChanged: true,
        chartError: false,
        chartErrorMessage: undefined,
      };
    });
  };

  handleSensitivityChange = (sensitivity: AlertRuleSensitivity) => {
    this.setState({sensitivity}, () => this.fetchAnomalies());
  };

  handleThresholdTypeChange = (thresholdType: AlertRuleThresholdType) => {
    const {triggers} = this.state;

    const triggerErrors = this.validateTriggers(triggers, thresholdType);
    this.setState(
      state => ({
        thresholdType,
        triggerErrors: new Map([...triggerErrors, ...state.triggerErrors]),
      }),
      () => this.fetchAnomalies()
    );
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
    let updateState = {};
    const {timeWindow, dataset} = this.state;
    const supportedTimeWindows = getTimeWindowOptions(dataset, value).map(
      windows => windows.value
    );
    switch (value) {
      case AlertRuleComparisonType.DYNAMIC:
        updateState = {
          comparisonType: value,
          comparisonDelta: undefined,
          thresholdType: AlertRuleThresholdType.ABOVE_AND_BELOW,
          timeWindow: supportedTimeWindows.includes(timeWindow)
            ? timeWindow
            : DEFAULT_DYNAMIC_TIME_WINDOW,
          sensitivity: AlertRuleSensitivity.MEDIUM,
          seasonality: AlertRuleSeasonality.AUTO,
        };
        break;
      case AlertRuleComparisonType.CHANGE:
        updateState = {
          comparisonType: value,
          comparisonDelta: DEFAULT_CHANGE_COMP_DELTA,
          thresholdType: AlertRuleThresholdType.ABOVE,
          timeWindow: supportedTimeWindows.includes(timeWindow)
            ? timeWindow
            : DEFAULT_CHANGE_TIME_WINDOW,
          sensitivity: undefined,
          seasonality: undefined,
        };
        break;
      case AlertRuleComparisonType.COUNT:
        updateState = {
          comparisonType: value,
          comparisonDelta: undefined,
          thresholdType: AlertRuleThresholdType.ABOVE,
          timeWindow: supportedTimeWindows.includes(timeWindow)
            ? timeWindow
            : DEFAULT_COUNT_TIME_WINDOW,
          sensitivity: undefined,
          seasonality: undefined,
        };
        break;
      default:
        break;
    }
    this.setState({...updateState, chartError: false, chartErrorMessage: undefined}, () =>
      this.fetchAnomalies()
    );
  };

  handleDeleteRule = async () => {
    const {organization, params} = this.props;
    const {ruleId} = params;

    try {
      await this.api.requestPromise(
        `/organizations/${organization.slug}/alert-rules/${ruleId}/`,
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
    metric.endSpan({name: 'saveAlertRule'});
  };

  handleCancel = () => {
    this.goBack();
  };

  handleMEPAlertDataset = (data: EventsStats | MultiSeriesEventsStats | null) => {
    const {isMetricsData} = data ?? {};
    const {organization} = this.props;

    if (
      isMetricsData === undefined ||
      !organization.features.includes('mep-rollout-flag')
    ) {
      return;
    }

    const {dataset} = this.state;
    if (isMetricsData && dataset === Dataset.TRANSACTIONS) {
      this.setState({dataset: Dataset.GENERIC_METRICS});
    }

    if (!isMetricsData && dataset === Dataset.GENERIC_METRICS) {
      this.setState({dataset: Dataset.TRANSACTIONS});
    }
  };

  handleEAPMetricsAlertDataset = (data: EventsStats | MultiSeriesEventsStats | null) => {
    if (!data) {
      return;
    }

    let timeseries: TimeSeries[];

    if (isEventsStats(data)) {
      const [, series] = convertEventsStatsToTimeSeriesData('', data);
      timeseries = [series];
    } else {
      timeseries = Object.values(data).map(result => {
        const [, series] = convertEventsStatsToTimeSeriesData('', result);
        return series;
      });
    }

    const seriesSamplingInfo = determineSeriesSampleCountAndIsSampled(
      timeseries,
      !isEventsStats(data)
    );
    const confidence = combineConfidenceForSeries(timeseries);

    this.setState({confidence, seriesSamplingInfo});
  };

  handleTimeSeriesDataFetched = (data: EventsStats | MultiSeriesEventsStats | null) => {
    const {isExtrapolatedData} = data ?? {};
    const currentData = formatStatsToHistoricalDataset(data);

    const newState: Partial<State> = {currentData};
    if (shouldShowOnDemandMetricAlertUI(this.props.organization)) {
      newState.isExtrapolatedChartData = Boolean(isExtrapolatedData);
    }
    this.setState(newState, () => this.fetchAnomalies());
    const {dataset, aggregate, query} = this.state;
    if (!isOnDemandMetricAlert(dataset, aggregate, query)) {
      this.handleMEPAlertDataset(data);
    }
    if (isEapAlertType(this.state.alertType)) {
      this.handleEAPMetricsAlertDataset(data);
    }
  };

  handleHistoricalTimeSeriesDataFetched(
    data: EventsStats | MultiSeriesEventsStats | null
  ) {
    const historicalData = formatStatsToHistoricalDataset(data);
    this.setState({historicalData}, () => this.fetchAnomalies());
  }

  timeWindowsAreConsistent() {
    const {currentData = [], historicalData = [], timeWindow} = this.state;
    const currentTimeWindow = getTimeWindowFromDataset(currentData, timeWindow);
    const historicalTimeWindow = getTimeWindowFromDataset(historicalData, timeWindow);
    return currentTimeWindow === historicalTimeWindow && currentTimeWindow === timeWindow;
  }

  async fetchAnomalies() {
    const {comparisonType, historicalData, currentData} = this.state;
    if (
      comparisonType !== AlertRuleComparisonType.DYNAMIC ||
      !(Array.isArray(currentData) && Array.isArray(historicalData)) ||
      currentData.length === 0 ||
      historicalData.length === 0 ||
      !this.timeWindowsAreConsistent()
    ) {
      return;
    }
    this.setState({chartError: false, chartErrorMessage: ''});

    const {organization, project} = this.props;
    const {timeWindow, sensitivity, seasonality, thresholdType} = this.state;

    const direction =
      thresholdType === AlertRuleThresholdType.ABOVE
        ? 'up'
        : thresholdType === AlertRuleThresholdType.BELOW
          ? 'down'
          : 'both';

    // extract the earliest timestamp from the current dataset
    const startOfCurrentTimeframe = currentData.reduce(
      (value, [timestamp]) => (value < timestamp ? value : timestamp),
      Infinity
    );
    const params = {
      organization_id: organization.id,
      project_id: project.id,
      config: {
        direction,
        time_period: timeWindow,
        sensitivity: sensitivity ?? AlertRuleSeasonality.AUTO,
        expected_seasonality: seasonality ?? AlertRuleSensitivity.MEDIUM,
      },
      // remove historical data that overlaps with current dataset
      historical_data: historicalData.filter(
        ([timestamp]) => timestamp < startOfCurrentTimeframe
      ),
      current_data: currentData,
    };

    try {
      const anomalies = await this.api.requestPromise(
        `/organizations/${organization.slug}/events/anomalies/`,
        {method: 'POST', data: params}
      );
      this.setState({anomalies});
    } catch (e: any) {
      let chartErrorMessage: string | undefined;
      if (e.responseJSON) {
        if (typeof e.responseJSON === 'object' && e.responseJSON.detail) {
          chartErrorMessage = e.responseJSON.detail;
        }
        if (typeof e.responseJSON === 'string') {
          chartErrorMessage = e.responseJSON;
        }
      } else if (typeof e.message === 'string') {
        chartErrorMessage = e.message;
      } else {
        chartErrorMessage = t('Something went wrong when rendering this chart.');
      }

      this.setState({
        chartError: true,
        chartErrorMessage,
      });
    }
  }

  // If the user is creating an on-demand metric alert, we want to override the dataset
  // to be generic metrics instead of transactions
  checkOnDemandMetricsDataset = (dataset: Dataset, query: string) => {
    if (!hasOnDemandMetricAlertFeature(this.props.organization)) {
      return dataset;
    }
    if (dataset !== Dataset.TRANSACTIONS || !isOnDemandQueryString(query)) {
      return dataset;
    }
    return Dataset.GENERIC_METRICS;
  };

  // We are not allowing the creation of new transaction alerts
  determinePerformanceDataset = () => {
    // TODO: once all alerts are migrated to MEP, we can set the default to GENERIC_METRICS and remove this as well as
    // logic in handleMEPDataset, handleTimeSeriesDataFetched and checkOnDemandMetricsDataset
    const {dataset} = this.state;
    const {organization} = this.props;
    const hasMetricsFeatureFlags =
      organization.features.includes('mep-rollout-flag') ||
      hasOnDemandMetricAlertFeature(organization);

    if (hasMetricsFeatureFlags && dataset === Dataset.TRANSACTIONS) {
      return Dataset.GENERIC_METRICS;
    }
    return dataset;
  };

  renderLoading() {
    return this.renderBody();
  }

  renderTriggerChart() {
    const {organization, ruleId, rule, location} = this.props;

    const {
      query,
      project,
      timeWindow,
      triggers,
      aggregate,
      environment,
      thresholdType,
      comparisonDelta,
      comparisonType,
      resolveThreshold,
      eventTypes,
      dataset,
      alertType,
      isQueryValid,
      anomalies,
      chartError,
      chartErrorMessage,
      confidence,
      seriesSamplingInfo,
      extrapolationMode,
    } = this.state;

    const traceItemType = getTraceItemTypeForDatasetAndEventType(dataset, eventTypes);

    if (chartError) {
      return (
        <ErrorChart
          style={{marginTop: 0}}
          errorMessage={`${chartErrorMessage}`}
          isAllowIndexed
          isQueryValid
        />
      );
    }
    const isOnDemand = isOnDemandMetricAlert(dataset, aggregate, query);

    let formattedAggregate = aggregate;

    const func = parseFunction(aggregate);
    if (func && isEapAlertType(alertType)) {
      formattedAggregate = prettifyParsedFunction(func);
    }

    const chartProps: ComponentProps<typeof TriggersChart> = {
      organization,
      projects: [project],
      triggers,
      anomalies: comparisonType === AlertRuleComparisonType.DYNAMIC ? anomalies : [],
      location,
      query: this.chartQuery,
      aggregate,
      formattedAggregate,
      dataset,
      newAlertOrQuery: !ruleId || query !== rule.query,
      timeWindow,
      environment,
      resolveThreshold,
      thresholdType,
      comparisonDelta,
      comparisonType,
      isQueryValid,
      isOnDemandMetricAlert: isOnDemand,
      showTotalCount: !['span_metrics'].includes(alertType) && !isOnDemand,
      onDataLoaded: this.handleTimeSeriesDataFetched,
      includeHistorical: comparisonType === AlertRuleComparisonType.DYNAMIC,
      onHistoricalDataLoaded: this.handleHistoricalTimeSeriesDataFetched,
      theme: this.props.theme,
      confidence,
      seriesSamplingInfo,
      traceItemType: traceItemType ?? undefined,
      extrapolationMode,
    };

    let formattedQuery = `event.type:${eventTypes?.join(',')}`;
    if (isEapAlertType(alertType)) {
      formattedQuery = '';
    }

    const wizardBuilderChart = (
      <TriggersChart
        {...chartProps}
        header={
          <ChartHeader>
            <AlertName>{AlertWizardAlertNames[alertType]}</AlertName>
            {!isCrashFreeAlert(dataset) && (
              <AlertInfo>
                <StyledCircleIndicator size={8} />
                <Aggregate>{formattedAggregate}</Aggregate>
                {formattedQuery}
              </AlertInfo>
            )}
          </ChartHeader>
        }
      />
    );

    return wizardBuilderChart;
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
      thresholdType,
      comparisonDelta,
      comparisonType,
      resolveThreshold,
      sensitivity,
      loading,
      eventTypes,
      dataset,
      alertType,
      isExtrapolatedChartData,
      triggersHaveChanged,
      extrapolationMode,
    } = this.state;

    const wizardBuilderChart = this.renderTriggerChart();
    //  Used to hide specific fields like actions while migrating metric alert rules.
    //  Currently used to help people add `is:unresolved` to their metric alert query.
    const isMigration = location?.query?.migration === '1';

    const triggerForm = (disabled: boolean) => (
      <Triggers
        disabled={disabled}
        projects={[project]}
        errors={this.state.triggerErrors}
        triggers={triggers}
        aggregate={aggregate}
        isMigration={isMigration}
        resolveThreshold={resolveThreshold}
        sensitivity={sensitivity}
        thresholdType={thresholdType}
        comparisonType={comparisonType}
        currentProject={project.slug}
        organization={organization}
        availableActions={this.state.availableActions}
        onChange={this.handleChangeTriggers}
        onThresholdTypeChange={this.handleThresholdTypeChange}
        onResolveThresholdChange={this.handleResolveThresholdChange}
        onSensitivityChange={this.handleSensitivityChange}
      />
    );

    const ruleNameOwnerForm = (disabled: boolean) => (
      <RuleNameOwnerForm disabled={disabled} project={project} />
    );

    const thresholdTypeForm = (disabled: boolean) => (
      <ThresholdTypeForm
        alertType={alertType}
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

    const hasAlertWrite = hasEveryAccess(['alerts:write'], {organization, project});
    const formDisabled = loading || !hasAlertWrite;

    const showErrorMigrationWarning =
      !!ruleId && isMigration && ruleNeedsErrorMigration(rule);

    const traceItemType = getTraceItemTypeForDatasetAndEventType(dataset, eventTypes);

    const showExtrapolationModeChangeWarning = getIsMigratedExtrapolationMode(
      extrapolationMode,
      dataset,
      traceItemType
    );

    // Rendering the main form body
    return (
      <Main width="full">
        <ProjectPermissionAlert access={['alerts:write']} project={project} />

        {eventView && <IncompatibleAlertQuery eventView={eventView} />}
        <OnDemandThresholdChecker
          projectId={project.id}
          isExtrapolatedChartData={!!isExtrapolatedChartData}
        >
          {({isOnDemandLimitReached}) => {
            const submitDisabled =
              formDisabled ||
              !this.state.isQueryValid ||
              (isExtrapolatedChartData &&
                isOnDemandQueryString(this.state.query) &&
                isOnDemandLimitReached);
            return (
              <Form
                model={this.form}
                apiMethod={ruleId ? 'PUT' : 'POST'}
                apiEndpoint={`/organizations/${organization.slug}/alert-rules/${
                  ruleId ? `${ruleId}/` : ''
                }`}
                submitDisabled={submitDisabled}
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
                  alertType,
                }}
                saveOnBlur={false}
                onSubmit={this.handleSubmit}
                onSubmitSuccess={onSubmitSuccess}
                onCancel={this.handleCancel}
                onFieldChange={this.handleFieldChange}
                extraButton={
                  rule.id ? (
                    <Confirm
                      disabled={formDisabled}
                      message={t(
                        'Are you sure you want to delete "%s"? You won\'t be able to view the history of this alert once it\'s deleted.',
                        rule.name
                      )}
                      header={<h5>{t('Delete Alert Rule?')}</h5>}
                      priority="danger"
                      confirmText={t('Delete Rule')}
                      onConfirm={() => {
                        this.handleDeleteRule();
                      }}
                    >
                      <Button priority="danger">{t('Delete Rule')}</Button>
                    </Confirm>
                  ) : null
                }
                submitLabel={
                  isMigration && !triggersHaveChanged
                    ? t('Looks good to me!')
                    : t('Save Rule')
                }
              >
                <List symbol="colored-numeric">
                  <RuleConditionsForm
                    aggregate={aggregate}
                    alertType={alertType}
                    allowChangeEventTypes={
                      dataset === Dataset.ERRORS || alertType === 'custom_transactions'
                    }
                    comparisonDelta={comparisonDelta}
                    comparisonType={comparisonType}
                    dataset={dataset}
                    disableProjectSelector={disableProjectSelector}
                    disabled={formDisabled}
                    isEditing={Boolean(ruleId)}
                    isErrorMigration={showErrorMigrationWarning}
                    isExtrapolatedChartData={isExtrapolatedChartData}
                    isOnDemandLimitReached={isOnDemandLimitReached}
                    isTransactionMigration={isMigration && !showErrorMigrationWarning}
                    onComparisonDeltaChange={value =>
                      this.handleFieldChange('comparisonDelta', value)
                    }
                    onFilterSearch={this.handleFilterUpdate}
                    onTimeWindowChange={value =>
                      this.handleFieldChange('timeWindow', value)
                    }
                    organization={organization}
                    project={project}
                    router={router}
                    thresholdChart={wizardBuilderChart}
                    timeWindow={timeWindow}
                    eventTypes={eventTypes}
                    extrapolationMode={extrapolationMode}
                  />

                  <AlertListItem>
                    {
                      <HeadingContainer>
                        {t('Set thresholds')}
                        {showExtrapolationModeChangeWarning && (
                          <WarningIcon
                            tooltipProps={{
                              title: tct(
                                'Your thresholds may need to be adjusted to take into account [samplingLink:sampling].',
                                {
                                  samplingLink: (
                                    <ExternalLink
                                      href="https://docs.sentry.io/product/explore/trace-explorer/#how-sampling-affects-queries-in-trace-explorer"
                                      openInNewTab
                                    />
                                  ),
                                }
                              ),
                              isHoverable: true,
                            }}
                            id="thresholds-warning-icon"
                          />
                        )}
                      </HeadingContainer>
                    }
                  </AlertListItem>
                  {thresholdTypeForm(formDisabled)}
                  {showErrorMigrationWarning && (
                    <Alert.Container>
                      <Alert variant="warning">
                        {tct(
                          "We've added [code:is:unresolved] to your events filter; please make sure the current thresholds are still valid as this alert is now filtering out resolved and archived errors.",
                          {
                            code: <code />,
                          }
                        )}
                      </Alert>
                    </Alert.Container>
                  )}
                  {triggerForm(formDisabled)}
                  {ruleNameOwnerForm(formDisabled)}
                </List>
              </Form>
            );
          }}
        </OnDemandThresholdChecker>
      </Main>
    );
  }
}

function formatStatsToHistoricalDataset(
  data: EventsStats | MultiSeriesEventsStats | null
): Array<[number, {count: number}]> {
  return Array.isArray(data?.data)
    ? (data.data.flatMap(([timestamp, entries]) =>
        entries.map(entry => [timestamp, entry] as [number, {count: number}])
      ) ?? [])
    : [];
}

function getTimeWindowFromDataset(
  data: ReturnType<typeof formatStatsToHistoricalDataset>,
  defaultWindow: TimeWindow
): number {
  for (let i = 0; i < data.length; i++) {
    const [timestampA] = data[i] ?? [];
    const [timestampB] = data[i + 1] ?? [];
    if (!timestampA || !timestampB) {
      break;
    }
    // ignore duplicate timestamps
    if (timestampA === timestampB) {
      continue;
    }
    return Math.abs(timestampB - timestampA) / 60;
  }
  return defaultWindow;
}

function WarningIcon({tooltipProps, id}: {id: string; tooltipProps?: TooltipProps}) {
  return (
    <Tooltip {...tooltipProps} title={tooltipProps?.title} skipWrapper>
      <StyledIconWarning id={id} size="md" color="yellow300" />
    </Tooltip>
  );
}

const Main = styled(Layout.Main)`
  max-width: 1000px;
`;

const AlertListItem = styled(ListItem)`
  margin: ${space(2)} 0 ${space(1)} 0;
  font-size: ${p => p.theme.fontSize.xl};
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
  font-size: ${p => p.theme.fontSize.sm};
  font-family: ${p => p.theme.text.family};
  font-weight: ${p => p.theme.fontWeight.normal};
  color: ${p => p.theme.tokens.content.primary};
`;

const StyledCircleIndicator = styled(CircleIndicator)`
  background: ${p => p.theme.subText};
  height: ${space(1)};
  margin-right: ${space(0.5)};
`;

const Aggregate = styled('span')`
  margin-right: ${space(1)};
`;

const HeadingContainer = styled('div')`
  display: flex;
  align-items: center;
  gap: ${p => p.theme.space.sm};
`;

const StyledIconWarning = styled(IconWarning)`
  animation: ${() => pulse(1.15)} 1s ease infinite;
`;

export default withProjects(RuleFormContainer);
