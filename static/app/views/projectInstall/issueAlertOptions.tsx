import * as React from 'react';
import styled from '@emotion/styled';
import * as Sentry from '@sentry/react';
import isEqual from 'lodash/isEqual';

import AsyncComponent from 'sentry/components/asyncComponent';
import Input from 'sentry/components/forms/controls/input';
import RadioGroup from 'sentry/components/forms/controls/radioGroup';
import SelectControl from 'sentry/components/forms/selectControl';
import PageHeading from 'sentry/components/pageHeading';
import {t} from 'sentry/locale';
import space from 'sentry/styles/space';
import {Organization} from 'sentry/types';
import withOrganization from 'sentry/utils/withOrganization';

enum MetricValues {
  ERRORS,
  USERS,
}
enum Actions {
  ALERT_ON_EVERY_ISSUE,
  CUSTOMIZED_ALERTS,
  CREATE_ALERT_LATER,
}

const UNIQUE_USER_FREQUENCY_CONDITION =
  'sentry.rules.conditions.event_frequency.EventUniqueUserFrequencyCondition';
const EVENT_FREQUENCY_CONDITION =
  'sentry.rules.conditions.event_frequency.EventFrequencyCondition';
const NOTIFY_EVENT_ACTION = 'sentry.rules.actions.notify_event.NotifyEventAction';
export const EVENT_FREQUENCY_PERCENT_CONDITION =
  'sentry.rules.conditions.event_frequency.EventFrequencyPercentCondition';

const METRIC_CONDITION_MAP = {
  [MetricValues.ERRORS]: EVENT_FREQUENCY_CONDITION,
  [MetricValues.USERS]: UNIQUE_USER_FREQUENCY_CONDITION,
} as const;

const DEFAULT_PLACEHOLDER_VALUE = '10';

type StateUpdater = (updatedData: RequestDataFragment) => void;
type Props = AsyncComponent['props'] & {
  onChange: StateUpdater;
  organization: Organization;
};

type State = AsyncComponent['state'] & {
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
  actions: {id: string}[];
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
      condition = EVENT_FREQUENCY_CONDITION;
      break;
    case MetricValues.USERS:
      condition = UNIQUE_USER_FREQUENCY_CONDITION;
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

class IssueAlertOptions extends AsyncComponent<Props, State> {
  getDefaultState(): State {
    return {
      ...super.getDefaultState(),
      conditions: [],
      intervalChoices: [],
      alertSetting: Actions.CREATE_ALERT_LATER.toString(),
      metric: MetricValues.ERRORS,
      interval: '',
      threshold: '',
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
    const options: [string, React.ReactNode][] = [
      [Actions.CREATE_ALERT_LATER.toString(), t("I'll create my own alerts later")],
      [Actions.ALERT_ON_EVERY_ISSUE.toString(), t('Alert me on every new issue')],
    ];

    if (hasProperlyLoadedConditions) {
      options.push([
        Actions.CUSTOMIZED_ALERTS.toString(),
        <CustomizeAlertsGrid
          key={Actions.CUSTOMIZED_ALERTS}
          onClick={e => {
            // XXX(epurkhiser): The `e.preventDefault` here is needed to stop
            // propagation of the click up to the label, causing it to focus
            // the radio input and lose focus on the select.
            e.preventDefault();
            const alertSetting = Actions.CUSTOMIZED_ALERTS.toString();
            this.setStateAndUpdateParents({alertSetting});
          }}
        >
          {t('When there are more than')}
          <InlineInput
            type="number"
            min="0"
            name=""
            placeholder={DEFAULT_PLACEHOLDER_VALUE}
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
            data-test-id="metric-select-control"
          />
          {t('a unique error in')}
          <InlineSelectControl
            value={this.state.interval}
            options={this.state.intervalChoices?.map(([value, label]) => ({
              value,
              label,
            }))}
            onChange={interval =>
              this.setStateAndUpdateParents({interval: interval.value})
            }
            data-test-id="interval-select-control"
          />
        </CustomizeAlertsGrid>,
      ]);
    }
    return options.map(([choiceValue, node]) => [
      choiceValue,
      <RadioItemWrapper key={choiceValue}>{node}</RadioItemWrapper>,
    ]);
  }

  getUpdatedData(): RequestDataFragment {
    let defaultRules: boolean;
    let shouldCreateCustomRule: boolean;
    const alertSetting: Actions = parseInt(this.state.alertSetting, 10);
    switch (alertSetting) {
      case Actions.ALERT_ON_EVERY_ISSUE:
        defaultRules = true;
        shouldCreateCustomRule = false;
        break;
      case Actions.CREATE_ALERT_LATER:
        defaultRules = false;
        shouldCreateCustomRule = false;
        break;
      case Actions.CUSTOMIZED_ALERTS:
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
      actions: [{id: NOTIFY_EVENT_ACTION}],
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
      | null,
    callback?: () => void
  ): void {
    this.setState(state, () => {
      callback?.();
      this.props.onChange(this.getUpdatedData());
    });
  }

  getEndpoints(): ReturnType<AsyncComponent['getEndpoints']> {
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

    this.setStateAndUpdateParents({
      conditions,
      intervalChoices,
      interval,
    });
  }

  renderBody(): React.ReactElement {
    const issueAlertOptionsChoices = this.getIssueAlertsChoices(
      this.state.conditions?.length > 0
    );
    return (
      <React.Fragment>
        <PageHeadingWithTopMargins withMargins>
          {t('Set your default alert settings')}
        </PageHeadingWithTopMargins>
        <RadioGroupWithPadding
          choices={issueAlertOptionsChoices}
          label={t('Options for creating an alert')}
          onChange={alertSetting => this.setStateAndUpdateParents({alertSetting})}
          value={this.state.alertSetting}
        />
      </React.Fragment>
    );
  }
}

export default withOrganization(IssueAlertOptions);

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
  padding: ${space(3)} 0;
  margin-bottom: 50px;
  box-shadow: 0 -1px 0 rgba(0, 0, 0, 0.1);
`;
const PageHeadingWithTopMargins = styled(PageHeading)`
  margin-top: 65px;
`;
const RadioItemWrapper = styled('div')`
  min-height: 35px;
  display: flex;
  flex-direction: column;
  justify-content: center;
`;
