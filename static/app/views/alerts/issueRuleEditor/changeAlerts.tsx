import {IssueAlertRuleCondition, IssueAlertRuleConditionTemplate} from 'app/types/alerts';

export const CHANGE_ALERT_CONDITION_IDS = [
  'sentry.rules.conditions.event_frequency.EventFrequencyCondition',
  'sentry.rules.conditions.event_frequency.EventUniqueUserFrequencyCondition',
  'sentry.rules.conditions.event_frequency.EventFrequencyPercentCondition',
];

export const CHANGE_ALERT_PLACEHOLDERS_LABELS = {
  'sentry.rules.conditions.event_frequency.EventFrequencyCondition':
    'Number of errors in an issue is...',
  'sentry.rules.conditions.event_frequency.EventUniqueUserFrequencyCondition':
    'Number of users affected by an issue is...',
  'sentry.rules.conditions.event_frequency.EventFrequencyPercentCondition':
    'Percent of sessions affected by an issue is...',
};

export const getChangeAlertNode = (
  node: IssueAlertRuleConditionTemplate,
  item: IssueAlertRuleCondition,
  itemIdx: number,
  onPropertyChange: (ruleIndex: number, prop: string, val: string) => void
): IssueAlertRuleConditionTemplate => {
  const comparisonTypeChoices = {
    count: 'more than {value} in {interval}',
    percent: '{value}% higher in {interval} compared to {comparisonInterval} ago',
  };

  let changeAlertNode: IssueAlertRuleConditionTemplate = {
    ...node,
    label: node.label.replace('...', ' {comparisonType}'),
    formFields: {
      ...node.formFields,
      comparisonType: {
        type: 'choice',
        choices: [
          ['count', comparisonTypeChoices.count],
          ['percent', comparisonTypeChoices.percent],
        ],
        initial: null,
      },
      ...(node.formFields
        ? {
            interval: {
              ...node.formFields.interval,
              initial: node.formFields?.interval.initial || '5m',
            },
          }
        : {}),
    },
  };

  changeAlertNode = {
    ...changeAlertNode,
    label: item.comparisonType
      ? changeAlertNode.label.replace(
          '{comparisonType}',
          comparisonTypeChoices[item.comparisonType]
        )
      : changeAlertNode.label,
  };

  if (item?.comparisonType === 'percent') {
    const intervalSelected = (
      changeAlertNode.formFields?.interval as {choices?: [string, string][]}
    ).choices?.find(([_interval]) => _interval === item.interval);

    const formComparisonInterval = changeAlertNode.formFields?.comparisonInterval as {
      choices?: [string, string][];
    };
    const comparisonIntervalSelected = formComparisonInterval?.choices?.find(
      ([_comparisonInterval]) => _comparisonInterval === item.comparisonInterval
    );

    if (
      intervalSelected &&
      ['1d', '1w', '30d'].includes(intervalSelected[0]) &&
      comparisonIntervalSelected &&
      !['1d', '1w', '30d'].includes(comparisonIntervalSelected[0])
    ) {
      onPropertyChange(itemIdx, 'comparisonInterval', intervalSelected[0]);
    }

    let choices: [string, string][];
    if (intervalSelected && intervalSelected[0] === '30d') {
      choices = [['30d', '30 days']];
    } else if (intervalSelected && intervalSelected[0] === '1w') {
      choices = [
        ['1w', 'one week'],
        ['30d', '30 days'],
      ];
    } else if (intervalSelected && intervalSelected[0] === '1d') {
      choices = [
        ['1d', 'one day'],
        ['1w', 'one week'],
        ['30d', '30 days'],
      ];
    } else {
      choices = [
        intervalSelected || ['5m', '5 minutes'],
        ['1d', 'one day'],
        ['1w', 'one week'],
        ['30d', '30 days'],
      ];
    }

    return {
      ...changeAlertNode,
      formFields: {
        ...changeAlertNode.formFields,
        comparisonInterval: {
          type: 'choice',
          choices,
        },
      },
    } as IssueAlertRuleConditionTemplate;
  }

  return changeAlertNode;
};
