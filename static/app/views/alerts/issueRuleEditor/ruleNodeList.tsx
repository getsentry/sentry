import * as React from 'react';
import styled from '@emotion/styled';

import FeatureBadge from 'app/components/featureBadge';
import SelectControl from 'app/components/forms/selectControl';
import {t} from 'app/locale';
import space from 'app/styles/space';
import {Organization, Project} from 'app/types';
import {
  IssueAlertRuleAction,
  IssueAlertRuleActionTemplate,
  IssueAlertRuleCondition,
  IssueAlertRuleConditionTemplate,
} from 'app/types/alerts';
import {EVENT_FREQUENCY_PERCENT_CONDITION} from 'app/views/projectInstall/issueAlertOptions';

import RuleNode from './ruleNode';

const CHANGE_ALERT_CONDITION_IDS = [
  'sentry.rules.conditions.event_frequency.EventFrequencyCondition',
  'sentry.rules.conditions.event_frequency.EventUniqueUserFrequencyCondition',
  'sentry.rules.conditions.event_frequency.EventFrequencyPercentCondition',
];

type Props = {
  project: Project;
  organization: Organization;
  /**
   * All available actions or conditions
   */
  nodes: IssueAlertRuleActionTemplate[] | IssueAlertRuleConditionTemplate[] | null;
  /**
   * actions/conditions that have been added to the rule
   */
  items: IssueAlertRuleAction[] | IssueAlertRuleCondition[];
  /**
   * Placeholder for select control
   */
  placeholder: string;
  disabled: boolean;
  error: React.ReactNode;
  selectType?: 'grouped';
  onPropertyChange: (ruleIndex: number, prop: string, val: string) => void;
  onAddRow: (value: string) => void;
  onResetRow: (ruleIndex: number, name: string, value: string) => void;
  onDeleteRow: (ruleIndex: number) => void;
};

class RuleNodeList extends React.Component<Props> {
  getNode = (
    id: string,
    itemIdx: number
  ):
    | IssueAlertRuleActionTemplate
    | IssueAlertRuleConditionTemplate
    | null
    | undefined => {
    const {nodes, items} = this.props;
    const node = nodes ? nodes.find(n => n.id === id) : null;

    if (!node) {
      return null;
    }

    if (!CHANGE_ALERT_CONDITION_IDS.includes(node.id)) {
      return node;
    }

    const item = items.find(i => i.id === node.id);

    const changeAlertNode: IssueAlertRuleConditionTemplate = {
      ...node,
      label: node.label.replace('more than', '{comparisonType} than'),
      formFields: {
        ...node.formFields,
        comparisonType: {
          type: 'choice',
          choices: [
            ['count', 'more'],
            ['percent', 'higher'],
          ],
          initial: 'count',
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

    if (item?.comparisonType === 'percent') {
      const intervalSelected = (
        node.formFields?.interval as {choices?: [string, string][]}
      ).choices?.find(([_interval]) => _interval === item.interval);

      const formComparisonInterval = node.formFields?.comparisonInterval as {
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
        this.props.onPropertyChange(itemIdx, 'comparisonInterval', intervalSelected[0]);
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
        label: changeAlertNode.label
          .replace('times ', '')
          .replace('{value}', '{value} %')
          .concat(' compared to {comparisonInterval} before'),
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

  render() {
    const {
      onAddRow,
      onResetRow,
      onDeleteRow,
      onPropertyChange,
      nodes,
      placeholder,
      items,
      organization,
      project,
      disabled,
      error,
      selectType,
    } = this.props;

    const shouldUsePrompt = project.features?.includes?.('issue-alerts-targeting');
    const enabledNodes = nodes ? nodes.filter(({enabled}) => enabled) : [];

    const createSelectOptions = (actions: IssueAlertRuleActionTemplate[]) =>
      actions.map(node => {
        const isNew = node.id === EVENT_FREQUENCY_PERCENT_CONDITION;
        return {
          value: node.id,
          label: (
            <React.Fragment>
              {isNew && <StyledFeatureBadge type="new" noTooltip />}
              {shouldUsePrompt && node.prompt?.length > 0 ? node.prompt : node.label}
            </React.Fragment>
          ),
        };
      });

    let options: any = !selectType ? createSelectOptions(enabledNodes) : [];

    if (selectType === 'grouped') {
      const grouped = enabledNodes.reduce(
        (acc, curr) => {
          if (curr.actionType === 'ticket') {
            acc.ticket.push(curr);
          } else {
            acc.notify.push(curr);
          }
          return acc;
        },
        {
          notify: [] as IssueAlertRuleActionTemplate[],
          ticket: [] as IssueAlertRuleActionTemplate[],
        }
      );

      options = Object.entries(grouped)
        .filter(([_, values]) => values.length)
        .map(([key, values]) => {
          const label =
            key === 'ticket'
              ? t('Create new\u{2026}')
              : t('Send notification to\u{2026}');

          return {label, options: createSelectOptions(values)};
        });
    }

    return (
      <React.Fragment>
        <RuleNodes>
          {error}
          {items.map((item, idx) => (
            <RuleNode
              key={idx}
              index={idx}
              node={this.getNode(item.id, idx)}
              onDelete={onDeleteRow}
              onPropertyChange={onPropertyChange}
              onReset={onResetRow}
              data={item}
              organization={organization}
              project={project}
              disabled={disabled}
            />
          ))}
        </RuleNodes>
        <StyledSelectControl
          placeholder={placeholder}
          value={null}
          onChange={obj => onAddRow(obj ? obj.value : obj)}
          options={options}
          disabled={disabled}
        />
      </React.Fragment>
    );
  }
}

export default RuleNodeList;

const StyledSelectControl = styled(SelectControl)`
  width: 100%;
`;

const RuleNodes = styled('div')`
  display: grid;
  margin-bottom: ${space(1)};
  grid-gap: ${space(1)};

  @media (max-width: ${p => p.theme.breakpoints[1]}) {
    grid-auto-flow: row;
  }
`;

const StyledFeatureBadge = styled(FeatureBadge)`
  margin: 0 ${space(1)} 0 0;
`;
