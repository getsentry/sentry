import styled from '@emotion/styled';
import * as Sentry from '@sentry/react';
import isEqual from 'lodash/isEqual';

import DeprecatedAsyncComponent from 'sentry/components/deprecatedAsyncComponent';
import RadioGroup from 'sentry/components/forms/controls/radioGroup';
import SelectControl from 'sentry/components/forms/controls/selectControl';
import Input from 'sentry/components/input';
import {SupportedLanguages} from 'sentry/components/onboarding/frameworkSuggestionModal';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {Organization} from 'sentry/types';
import {
  IssueAlertActionType,
  IssueAlertConditionType,
  IssueAlertRuleAction,
} from 'sentry/types/alerts';
import withOrganization from 'sentry/utils/withOrganization';

export enum MetricValues {
  ERRORS,
  USERS,
}

export enum RuleAction {
  DEFAULT_ALERT,
  CUSTOMIZED_ALERTS,
  CREATE_ALERT_LATER,
}

const ISSUE_ALERT_DEFAULT_ACTION: Omit<
  IssueAlertRuleAction,
  'label' | 'name' | 'prompt'
> = {
  id: IssueAlertActionType.NOTIFY_EMAIL,
  targetType: 'IssueOwners',
};

const METRIC_CONDITION_MAP = {
  [MetricValues.ERRORS]: IssueAlertConditionType.EVENT_FREQUENCY,
  [MetricValues.USERS]: IssueAlertConditionType.EVENT_UNIQUE_USER_FREQUENCY,
} as const;

type StateUpdater = (updatedData: RequestDataFragment) => void;
type Props = DeprecatedAsyncComponent['props'] & {
  onChange: StateUpdater;
  organization: Organization;
  alertSetting?: string;
  interval?: string;
  metric?: MetricValues;
  platformLanguage?: SupportedLanguages;
  threshold?: string;
};

type State = DeprecatedAsyncComponent['state'] & {
  alertSetting: string;
  // TODO(ts): When we have alert conditional types, convert this
  conditions: any;
  interval: string;
  intervalChoices: [string, string][] | undefined;
  metric: MetricValues;

  threshold: string;
};

type RequestDataFragment = {
  actionMatch: string;
  actions: Omit<IssueAlertRuleAction, 'label' | 'name' | 'prompt'>[];
  conditions: {id: string; interval: string; value: string}[] | undefined;
  defaultRules: boolean;
  frequency: number;
  name: string;
  shouldCreateCustomRule: boolean;
};

function getConditionFrom(
  interval: string,
  metricValue: MetricValues,
  threshold: string
): {id: string; interval: string; value: string} {
  let condition: string;
  switch (metricValue) {
    case MetricValues.ERRORS:
      condition = IssueAlertConditionType.EVENT_FREQUENCY;
      break;
    case MetricValues.USERS:
      condition = IssueAlertConditionType.EVENT_UNIQUE_USER_FREQUENCY;
      break;
    default:
      throw new RangeError('Supplied metric value is not handled');
  }
  return {
    interval,
    id: condition,
    value: threshold,
  };
}

function unpackConditions(conditions: any[]) {
  const equalityReducer = (acc, curr) => {
    if (!acc || !curr || !isEqual(acc, curr)) {
      return null;
    }
    return acc;
  };

  const intervalChoices = conditions
    .map(condition => condition.formFields?.interval?.choices)
    .reduce(equalityReducer);
  return {intervalChoices, interval: intervalChoices?.[0]?.[0]};
}

class IssueAlertOptions extends DeprecatedAsyncComponent<Props, State> {
  getDefaultState(): State {
    return {
      ...super.getDefaultState(),
      conditions: [],
      intervalChoices: [],
      alertSetting: this.props.alertSetting ?? RuleAction.DEFAULT_ALERT.toString(),
      metric: this.props.metric ?? MetricValues.ERRORS,
      interval: this.props.interval ?? '',
      threshold: this.props.threshold ?? '10',
    };
  }

  getAvailableMetricOptions() {
    return [
      {value: MetricValues.ERRORS, label: t('occurrences of')},
      {value: MetricValues.USERS, label: t('users affected by')},
    ].filter(({value}) => {
      return this.state.conditions?.some?.(
        object => object?.id === METRIC_CONDITION_MAP[value]
      );
    });
  }

  getIssueAlertsChoices(
    hasProperlyLoadedConditions: boolean
  ): [string, string | React.ReactElement][] {
    const customizedAlertOption: [string, React.ReactNode] = [
      RuleAction.CUSTOMIZED_ALERTS.toString(),
      <CustomizeAlertsGrid
        key={RuleAction.CUSTOMIZED_ALERTS}
        onClick={e => {
          // XXX(epurkhiser): The `e.preventDefault` here is needed to stop
          // propagation of the click up to the label, causing it to focus
          // the radio input and lose focus on the select.
          e.preventDefault();
          const alertSetting = RuleAction.CUSTOMIZED_ALERTS.toString();
          this.setStateAndUpdateParents({alertSetting});
        }}
      >
        {t('When there are more than')}
        <InlineInput
          type="number"
          min="0"
          name=""
          placeholder="10"
          value={this.state.threshold}
          onChange={threshold =>
            this.setStateAndUpdateParents({threshold: threshold.target.value})
          }
          data-test-id="range-input"
        />
        <InlineSelectControl
          value={this.state.metric}
          options={this.getAvailableMetricOptions()}
          onChange={metric => this.setStateAndUpdateParents({metric: metric.value})}
        />
        {t('a unique error in')}
        <InlineSelectControl
          value={this.state.interval}
          options={this.state.intervalChoices?.map(([value, label]) => ({
            value,
            label,
          }))}
          onChange={interval => this.setStateAndUpdateParents({interval: interval.value})}
        />
      </CustomizeAlertsGrid>,
    ];

    const default_label = this.shouldUseNewDefaultSetting()
      ? t('Alert me on high priority issues')
      : t('Alert me on every new issue');

    const options: [string, React.ReactNode][] = [
      [RuleAction.DEFAULT_ALERT.toString(), default_label],
      ...(hasProperlyLoadedConditions ? [customizedAlertOption] : []),
      [RuleAction.CREATE_ALERT_LATER.toString(), t("I'll create my own alerts later")],
    ];
    return options.map(([choiceValue, node]) => [
      choiceValue,
      <RadioItemWrapper key={choiceValue}>{node}</RadioItemWrapper>,
    ]);
  }

  shouldUseNewDefaultSetting(): boolean {
    return (
      this.props.organization.features.includes('default-high-priority-alerts') &&
      (this.props.platformLanguage === SupportedLanguages.PYTHON ||
        this.props.platformLanguage === SupportedLanguages.JAVASCRIPT)
    );
  }

  getUpdatedData(): RequestDataFragment {
    let defaultRules: boolean;
    let shouldCreateCustomRule: boolean;
    const alertSetting: RuleAction = parseInt(this.state.alertSetting, 10);
    switch (alertSetting) {
      case RuleAction.DEFAULT_ALERT:
        defaultRules = true;
        shouldCreateCustomRule = false;
        break;
      case RuleAction.CREATE_ALERT_LATER:
        defaultRules = false;
        shouldCreateCustomRule = false;
        break;
      case RuleAction.CUSTOMIZED_ALERTS:
        defaultRules = false;
        shouldCreateCustomRule = true;
        break;
      default:
        throw new RangeError('Supplied alert creation action is not handled');
    }

    return {
      defaultRules,
      shouldCreateCustomRule,
      name: 'Send a notification for new issues',
      conditions:
        this.state.interval.length > 0 && this.state.threshold.length > 0
          ? [
              getConditionFrom(
                this.state.interval,
                this.state.metric,
                this.state.threshold
              ),
            ]
          : undefined,
      actions: [
        {
          ...ISSUE_ALERT_DEFAULT_ACTION,
          ...(this.props.organization.features.includes('issue-alert-fallback-targeting')
            ? {fallthroughType: 'ActiveMembers'}
            : {}),
        },
      ],
      actionMatch: 'all',
      frequency: 5,
    };
  }

  setStateAndUpdateParents<K extends keyof State>(
    state:
      | ((
          prevState: Readonly<State>,
          props: Readonly<Props>
        ) => Pick<State, K> | State | null)
      | Pick<State, K>
      | State
      | null
  ): void {
    this.setState(state, () => {
      this.props.onChange(this.getUpdatedData());
    });
  }

  getEndpoints(): ReturnType<DeprecatedAsyncComponent['getEndpoints']> {
    return [['conditions', `/projects/${this.props.organization.slug}/rule-conditions/`]];
  }

  onLoadAllEndpointsSuccess(): void {
    const conditions = this.state.conditions?.filter?.(object =>
      Object.values(METRIC_CONDITION_MAP).includes(object?.id)
    );

    if (!conditions || conditions.length === 0) {
      this.setStateAndUpdateParents({
        conditions: undefined,
      });
      return;
    }

    const {intervalChoices, interval} = unpackConditions(conditions);
    if (!intervalChoices || !interval) {
      Sentry.withScope(scope => {
        scope.setExtra('props', this.props);
        scope.setExtra('state', this.state);
        Sentry.captureException(
          new Error('Interval choices or sent from API endpoint is inconsistent or empty')
        );
      });
      this.setStateAndUpdateParents({
        conditions: undefined,
      });
      return;
    }

    const newInterval =
      this.props.interval &&
      intervalChoices.some(intervalChoice => intervalChoice[0] === this.props.interval)
        ? this.props.interval
        : interval;

    this.setStateAndUpdateParents({
      conditions,
      intervalChoices,
      interval: newInterval,
    });
  }

  renderBody(): React.ReactElement {
    const issueAlertOptionsChoices = this.getIssueAlertsChoices(
      this.state.conditions?.length > 0
    );

    return (
      <Content>
        <RadioGroupWithPadding
          choices={issueAlertOptionsChoices}
          label={t('Options for creating an alert')}
          onChange={alertSetting => this.setStateAndUpdateParents({alertSetting})}
          value={this.state.alertSetting}
        />
      </Content>
    );
  }
}

export default withOrganization(IssueAlertOptions);

const Content = styled('div')`
  padding-top: ${space(2)};
  padding-bottom: ${space(4)};
`;

const CustomizeAlertsGrid = styled('div')`
  display: grid;
  grid-template-columns: repeat(5, max-content);
  gap: ${space(1)};
  align-items: center;
`;

const InlineInput = styled(Input)`
  width: 80px;
`;

const InlineSelectControl = styled(SelectControl)`
  width: 160px;
`;

const RadioGroupWithPadding = styled(RadioGroup)`
  margin-bottom: ${space(2)};
`;

const RadioItemWrapper = styled('div')`
  min-height: 35px;
  display: flex;
  flex-direction: column;
  justify-content: center;
`;
