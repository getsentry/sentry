import React, {ReactElement} from 'react';

import SelectControl from 'app/components/forms/selectControl';
import RadioGroup from 'app/views/settings/components/forms/controls/radioGroup';

import styled from '@emotion/styled';
import {t} from 'app/locale';
import AsyncComponent from 'app/components/asyncComponent';
import Input from 'app/views/settings/components/forms/controls/input';
import * as Sentry from '@sentry/browser';
import isEqual from 'lodash/isEqual';
import space from 'app/styles/space';
import PageHeading from 'app/components/pageHeading';
import withOrganization from 'app/utils/withOrganization';
import {Organization} from 'app/types';

enum MetricValues {
  ERRORS,
  USERS,
}
enum Actions {
  ALERT_ON_EVERY_ISSUE,
  CREATE_ALERT_LATER,
  CUSTOMIZED_ALERTS,
}

const UNIQUE_USER_FREQUENCY_CONDITION: string =
  'sentry.rules.conditions.event_frequency.EventUniqueUserFrequencyCondition';
const EVENT_FREQUENCY_CONDITION: string =
  'sentry.rules.conditions.event_frequency.EventFrequencyCondition';

// Semantically a set, but object literals have a more readable syntax.
const METRIC_CONDITION_MAP = {
  UNIQUE_USER_FREQUENCY_CONDITION,
  EVENT_FREQUENCY_CONDITION,
} as const;

type StateUpdater = (updatedData: RequestDataFragment) => void;
type Props = AsyncComponent['props'] & {
  organization: Organization;
  onChange: StateUpdater;
};

type State = AsyncComponent['state'] & {
  conditions: any;
  intervalChoices: [string, string][] | undefined;
  placeholder: string | undefined;
  threshold: number | undefined;
  interval: string | undefined;
  alertSetting: any;
  metric: any;
};

type RequestDataFragment = {
  default_rules: boolean;
  shouldCreateCustomRule: boolean;
  name: string;
  conditions: {interval: string; id: string; value: number}[] | undefined;
  actions: {id: string}[];
  actionMatch: string;
  frequency: number;
};

function getConditionFrom(
  interval: string,
  metricValue: MetricValues,
  threshold: number
): {interval: string; id: string; value: number} {
  let condition;
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
  const placeholder = conditions
    .map(condition => condition.formFields?.value?.placeholder)
    .reduce(equalityReducer);
  return {intervalChoices, placeholder, interval: intervalChoices?.[0]?.[0]};
}

class IssueAlertOptions extends AsyncComponent<Props, State> {
  getDefaultState(): State {
    return {
      ...super.getDefaultState(),
      conditions: [],
      intervalChoices: [],
      alertSetting: Actions.CUSTOMIZED_ALERTS,
      metric: MetricValues.ERRORS,
      interval: '',
      placeholder: '',
      threshold: undefined,
    };
  }

  getIssueAlertsChoices(
    hasProperlyLoadedConditions: boolean
  ): [Actions, string | ReactElement][] {
    const options: [Actions, string | ReactElement][] = [
      [Actions.ALERT_ON_EVERY_ISSUE, t('Alert me on every new issue')],
      [Actions.CREATE_ALERT_LATER, t("I'll create my own alerts later")],
    ];
    if (hasProperlyLoadedConditions) {
      options.unshift([
        Actions.CUSTOMIZED_ALERTS,
        <CustomizeAlertsGrid key={Actions.CUSTOMIZED_ALERTS}>
          {t('When there are more than')}
          <InlineInput
            type="number"
            name=""
            value={this.state.threshold}
            placeholder={this.state.placeholder}
            key={name}
            onChange={threshold =>
              this.setStateAndUpdateParents({threshold: threshold.target.value})
            }
          />
          <InlineSelectControl
            value={this.state.metric}
            choices={[
              [MetricValues.ERRORS, t('occurrences of')],
              [MetricValues.USERS, t('users affected by')],
            ]}
            onChange={metric => this.setStateAndUpdateParents({metric: metric.value})}
          />
          {t('a unique error in')}
          <InlineSelectControl
            value={this.state.interval}
            choices={this.state.intervalChoices}
            onChange={interval =>
              this.setStateAndUpdateParents({interval: interval.value})
            }
          />
        </CustomizeAlertsGrid>,
      ]);
    }
    return options;
  }

  getUpdatedData(): RequestDataFragment {
    let default_rules: boolean;
    let shouldCreateCustomRule: boolean;
    switch (this.state.alertSetting) {
      case Actions.ALERT_ON_EVERY_ISSUE:
        default_rules = true;
        shouldCreateCustomRule = false;
        break;
      case Actions.CREATE_ALERT_LATER:
        default_rules = false;
        shouldCreateCustomRule = false;
        break;
      case Actions.CUSTOMIZED_ALERTS:
        default_rules = false;
        shouldCreateCustomRule = true;
        break;
      default:
        throw new RangeError('Supplied alert creation action is not handled');
    }

    return {
      default_rules,
      shouldCreateCustomRule,
      name: 'Send a notification for new issues',
      conditions:
        this.state.metric && this.state.interval && this.state.threshold
          ? [
              getConditionFrom(
                this.state.interval,
                this.state.metric,
                this.state.threshold
              ),
            ]
          : undefined,
      actions: [{id: 'sentry.rules.actions.notify_event.NotifyEventAction'}],
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

  getEndpoints(): [string, string][] {
    return [['conditions', `/projects/${this.props.organization.slug}/rule-conditions/`]];
  }

  onLoadAllEndpointsSuccess(): void {
    const conditions = this.state.conditions.filter(object =>
      Object.values(METRIC_CONDITION_MAP).includes(object?.id)
    );

    if (conditions.length === 0) {
      return;
    }

    const {intervalChoices, placeholder, interval} = unpackConditions(conditions);
    if (!intervalChoices || !placeholder || !interval) {
      Sentry.withScope(scope => {
        scope.setExtra('props', this.props);
        scope.setExtra('state', this.state);
        Sentry.captureMessage(
          'Interval choices or value placeholder sent from API endpoint is inconsistent or empty'
        );
      });
      return;
    }

    this.setStateAndUpdateParents({
      conditions,
      intervalChoices,
      placeholder,
      interval,
    });
  }

  renderBody(): React.ReactElement {
    const issueAlertOptionsChoices = this.getIssueAlertsChoices(!!this.state.conditions);
    return (
      <React.Fragment>
        <PageHeadingWithTopMargins withMargins>
          {t('Create an alert')}
        </PageHeadingWithTopMargins>
        <RadioGroupWithPadding
          //@ts-ignore
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
  grid-gap: 10px;
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
  margin-top: 65px !important;
`;
