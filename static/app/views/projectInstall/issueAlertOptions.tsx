import styled from '@emotion/styled';

import {Flex} from '@sentry/scraps/layout';

import {RadioGroup} from 'sentry/components/forms/controls/radioGroup';
import {t} from 'sentry/locale';
import type {IssueAlertRule} from 'sentry/types/alerts';
import {IssueAlertActionType} from 'sentry/types/alerts';
import {
  IssueAlertNotificationOptions,
  type IssueAlertNotificationProps,
} from 'sentry/views/projectInstall/issueAlertNotificationOptions';

export enum RuleAction {
  DEFAULT_ALERT = 0,
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

export const DEFAULT_ISSUE_ALERT_OPTIONS_VALUES = {
  alertSetting: RuleAction.DEFAULT_ALERT,
};

export type RequestDataFragment = Pick<
  IssueAlertRule,
  'actionMatch' | 'actions' | 'frequency' | 'name'
> & {
  defaultRules: boolean;
  shouldCreateRule: boolean;
};

export interface AlertRuleOptions {
  alertSetting: RuleAction;
}

export function getRequestDataFragment({
  alertSetting = DEFAULT_ISSUE_ALERT_OPTIONS_VALUES.alertSetting,
}: Partial<AlertRuleOptions> = {}): RequestDataFragment {
  return {
    defaultRules: alertSetting === RuleAction.DEFAULT_ALERT,
    shouldCreateRule: alertSetting !== RuleAction.CREATE_ALERT_LATER,
    name: 'Send a notification for new issues',
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
}

export interface IssueAlertOptionsProps extends Partial<AlertRuleOptions> {
  onFieldChange: <K extends keyof AlertRuleOptions>(
    key: K,
    value: AlertRuleOptions[K]
  ) => void;
  notificationProps?: IssueAlertNotificationProps;
}

export function IssueAlertOptions({
  alertSetting = DEFAULT_ISSUE_ALERT_OPTIONS_VALUES.alertSetting,
  notificationProps,
  onFieldChange,
}: IssueAlertOptionsProps) {
  const issueAlertOptionsChoices: Array<[RuleAction, React.ReactNode]> = [
    [RuleAction.DEFAULT_ALERT, t('Alert me on high priority issues')],
    [RuleAction.CREATE_ALERT_LATER, t("I'll create my own alerts later")],
  ];

  return (
    <Content>
      <RadioGroup
        choices={issueAlertOptionsChoices.map(([choiceValue, node]) => [
          choiceValue.toString(),
          <Flex
            justify="start"
            align="center"
            wrap="wrap"
            gap="md"
            minHeight="35px"
            key={choiceValue}
          >
            {node}
          </Flex>,
        ])}
        label={t('Options for creating an alert')}
        onChange={val => {
          const selectedAlertSetting = parseRuleAction(val);
          onFieldChange('alertSetting', selectedAlertSetting);
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
  padding-top: ${p => p.theme.space.xl};
  padding-bottom: ${p => p.theme.space['3xl']};
  display: flex;
  flex-direction: column;
  gap: ${p => p.theme.space['3xl']};
`;
