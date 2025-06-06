import {useEffect} from 'react';
import styled from '@emotion/styled';

import {Input} from 'sentry/components/core/input';
import {Select} from 'sentry/components/core/select';
import RadioGroup from 'sentry/components/forms/controls/radioGroup';
import {t, tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {IssueAlertRule} from 'sentry/types/alerts';
import {IssueAlertActionType, IssueAlertConditionType} from 'sentry/types/alerts';
import IssueAlertNotificationOptions, {
  type IssueAlertNotificationProps,
} from 'sentry/views/projectInstall/issueAlertNotificationOptions';

export enum MetricValues {
  ERRORS = 0,
  USERS = 1,
}

export enum RuleAction {
  DEFAULT_ALERT = 0,
  CUSTOMIZED_ALERTS = 1,
  CREATE_ALERT_LATER = 2,
}

function isRuleAction(val: number): val is RuleAction {
  return Object.values(RuleAction).includes(val);
}

function parseRuleAction(val: number | string) {
  const ruleAction = parseInt(String(val), 10);
  if (isRuleAction(ruleAction)) {
    return ruleAction;
  }
  throw new RangeError('Supplied alert creation action is not handled');
}

function metricValueToConditionType(metricValue: MetricValues): IssueAlertConditionType {
  switch (metricValue) {
    case MetricValues.ERRORS:
      return IssueAlertConditionType.EVENT_FREQUENCY;
    case MetricValues.USERS:
      return IssueAlertConditionType.EVENT_UNIQUE_USER_FREQUENCY;
    default:
      throw new RangeError(`Supplied metric value ${metricValue} is not handled`);
  }
}

const METRIC_CHOICES = [
  {value: MetricValues.ERRORS, label: t('occurrences of')},
  {value: MetricValues.USERS, label: t('users affected by')},
];

const INTERVAL_CHOICES = [
  {value: '1m', label: t('one minute')},
  {value: '5m', label: t('5 minutes')},
  {value: '15m', label: t('15 minutes')},
  {value: '1h', label: t('one hour')},
  {value: '1d', label: t('one day')},
  {value: '1w', label: t('one week')},
  {value: '30d', label: t('30 days')},
];

export type RequestDataFragment = Pick<
  IssueAlertRule,
  'actionMatch' | 'actions' | 'conditions' | 'frequency' | 'name'
> & {
  defaultRules: boolean;
  shouldCreateCustomRule: boolean;
  shouldCreateRule: boolean;
};

export interface IssueAlertOptionsProps {
  onChange: (updatedData: RequestDataFragment) => void;
  alertSetting?: RuleAction;
  interval?: string;
  metric?: MetricValues;
  notificationProps?: IssueAlertNotificationProps;
  threshold?: string;
}

const getRequestDataFragment = ({
  alertSetting,
  interval,
  metric,
  threshold,
}: {
  alertSetting: RuleAction;
  interval: string;
  metric: MetricValues;
  threshold: string;
}): RequestDataFragment => {
  return {
    defaultRules: alertSetting === RuleAction.DEFAULT_ALERT,
    shouldCreateRule: alertSetting !== RuleAction.CREATE_ALERT_LATER,
    shouldCreateCustomRule: alertSetting === RuleAction.CUSTOMIZED_ALERTS,
    name: 'Send a notification for new issues',
    conditions:
      interval.length > 0 && threshold.length > 0
        ? [
            {
              interval,
              id: metricValueToConditionType(metric),
              value: threshold,
            },
          ]
        : [],
    actions: [
      {
        id: IssueAlertActionType.NOTIFY_EMAIL,
        targetType: 'IssueOwners',
        fallthroughType: 'ActiveMembers',
      },
    ],
    actionMatch: 'all',
    frequency: 5,
  };
};

export default function IssueAlertOptions({
  onChange,
  alertSetting = RuleAction.DEFAULT_ALERT,
  interval = '1m',
  metric = MetricValues.ERRORS,
  notificationProps,
  threshold = '10',
}: IssueAlertOptionsProps) {
  useEffect(() => {
    onChange(
      getRequestDataFragment({
        alertSetting,
        interval,
        metric,
        threshold,
      })
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const issueAlertOptionsChoices: Array<[RuleAction, React.ReactNode]> = [
    [RuleAction.DEFAULT_ALERT, t('Alert me on high priority issues')],
    [
      RuleAction.CUSTOMIZED_ALERTS,
      tct('When there are more than [threshold][metric] a unique error in [interval]', {
        threshold: (
          // 80px is just enough to see 6 digits at a time
          <div style={{width: '80px'}}>
            <Input
              type="number"
              min="0"
              name=""
              placeholder="10"
              value={threshold}
              onChange={e => {
                onChange(
                  getRequestDataFragment({
                    alertSetting,
                    interval,
                    metric,
                    threshold: e.target.value,
                  })
                );
              }}
              data-test-id="range-input"
            />
          </div>
        ),
        metric: (
          <div style={{width: '170px'}} onClick={e => e.preventDefault()}>
            <Select
              value={metric}
              options={METRIC_CHOICES}
              onChange={(option: (typeof METRIC_CHOICES)[number]) => {
                onChange(
                  getRequestDataFragment({
                    alertSetting,
                    interval,
                    metric: option.value,
                    threshold,
                  })
                );
              }}
            />
          </div>
        ),
        interval: (
          <div style={{width: '140px'}} onClick={e => e.preventDefault()}>
            <Select
              value={interval}
              options={INTERVAL_CHOICES}
              onChange={(option: (typeof INTERVAL_CHOICES)[number]) => {
                onChange(
                  getRequestDataFragment({
                    alertSetting,
                    interval: option.value,
                    metric,
                    threshold,
                  })
                );
              }}
            />
          </div>
        ),
      }),
    ],
    [RuleAction.CREATE_ALERT_LATER, t("I'll create my own alerts later")],
  ];

  return (
    <Content>
      <RadioGroup
        choices={issueAlertOptionsChoices.map(([choiceValue, node]) => [
          choiceValue.toString(),
          <RadioItemWrapper key={choiceValue}>{node}</RadioItemWrapper>,
        ])}
        label={t('Options for creating an alert')}
        onChange={val => {
          const selectedAlertSetting = parseRuleAction(val);
          onChange(
            getRequestDataFragment({
              alertSetting: selectedAlertSetting,
              interval,
              metric,
              threshold,
            })
          );
        }}
        value={alertSetting.toString()}
      />
      {notificationProps && alertSetting !== RuleAction.CREATE_ALERT_LATER && (
        <IssueAlertNotificationOptions {...notificationProps} />
      )}
    </Content>
  );
}

const Content = styled('div')`
  padding-top: ${space(2)};
  padding-bottom: ${space(4)};
  display: flex;
  flex-direction: column;
  gap: ${space(4)};
`;

const RadioItemWrapper = styled('div')`
  min-height: 35px;
  display: flex;
  flex-direction: row;
  gap: ${space(1)};
  flex-wrap: wrap;
  justify-content: flex-start;
  align-items: center;
`;
