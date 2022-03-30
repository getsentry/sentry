import * as React from 'react';
import styled from '@emotion/styled';

import FeatureBadge from 'sentry/components/featureBadge';
import SelectControl from 'sentry/components/forms/selectControl';
import {t} from 'sentry/locale';
import space from 'sentry/styles/space';
import {Organization, Project} from 'sentry/types';
import {
  IssueAlertRuleAction,
  IssueAlertRuleActionTemplate,
  IssueAlertRuleCondition,
  IssueAlertRuleConditionTemplate,
} from 'sentry/types/alerts';
import {
  CHANGE_ALERT_CONDITION_IDS,
  COMPARISON_INTERVAL_CHOICES,
  COMPARISON_TYPE_CHOICE_VALUES,
  COMPARISON_TYPE_CHOICES,
} from 'sentry/views/alerts/changeAlerts/constants';
import {EVENT_FREQUENCY_PERCENT_CONDITION} from 'sentry/views/projectInstall/issueAlertOptions';

import RuleNode from './ruleNode';

type Props = {
  disabled: boolean;
  error: React.ReactNode;
  /**
   * actions/conditions that have been added to the rule
   */
  items: IssueAlertRuleAction[] | IssueAlertRuleCondition[];
  /**
   * All available actions or conditions
   */
  nodes: IssueAlertRuleActionTemplate[] | IssueAlertRuleConditionTemplate[] | null;
  onAddRow: (value: string) => void;
  onDeleteRow: (ruleIndex: number) => void;
  onPropertyChange: (ruleIndex: number, prop: string, val: string) => void;
  onResetRow: (ruleIndex: number, name: string, value: string) => void;
  organization: Organization;
  /**
   * Placeholder for select control
   */
  placeholder: string;
  project: Project;
  selectType?: 'grouped';
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
    const {nodes, items, organization, onPropertyChange} = this.props;
    const node = nodes ? nodes.find(n => n.id === id) : null;

    if (!node) {
      return null;
    }

    if (
      !organization.features.includes('change-alerts') ||
      !CHANGE_ALERT_CONDITION_IDS.includes(node.id)
    ) {
      return node;
    }

    const item = items[itemIdx] as IssueAlertRuleCondition;

    let changeAlertNode: IssueAlertRuleConditionTemplate = {
      ...node,
      label: node.label.replace('...', ' {comparisonType}'),
      formFields: {
        ...node.formFields,
        comparisonType: {
          type: 'choice',
          choices: COMPARISON_TYPE_CHOICES,
          // give an initial value from not among choices so selector starts with none selected
          initial: 'select',
        },
      },
    };

    // item.comparison type isn't backfilled and is missing for old alert rules
    // this is a problem when an old alert is being edited, need to initialize it
    if (!item.comparisonType && item.value && item.name) {
      item.comparisonType = item.comparisonInterval === undefined ? 'count' : 'percent';
    }

    if (item.comparisonType) {
      changeAlertNode = {
        ...changeAlertNode,
        label: changeAlertNode.label.replace(
          '{comparisonType}',
          COMPARISON_TYPE_CHOICE_VALUES[item.comparisonType]
        ),
      };

      if (item.comparisonType === 'percent') {
        if (!item.comparisonInterval) {
          // comparisonInterval value in IssueRuleEditor state
          // is undefined even if initial value is defined
          // can't directly call onPropertyChange, because
          // getNode is called during render
          window.setTimeout(() => onPropertyChange(itemIdx, 'comparisonInterval', '1w'));
        }
        changeAlertNode = {
          ...changeAlertNode,
          formFields: {
            ...changeAlertNode.formFields,
            comparisonInterval: {
              type: 'choice',
              choices: COMPARISON_INTERVAL_CHOICES,
              initial: '1w',
            },
          },
        };
      }
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

        if (node.id.includes('NotifyEmailAction')) {
          return {
            value: node.id,
            label: t('Issue Owners, Team, or Member'),
          };
        }

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
          } else if (curr.id.includes('event_frequency')) {
            acc.frequency.push(curr);
          } else if (
            curr.id.includes('sentry.rules.conditions') &&
            !curr.id.includes('event_frequency')
          ) {
            acc.change.push(curr);
          } else if (curr.id.includes('sentry.integrations')) {
            acc.notifyIntegration.push(curr);
          } else if (curr.id.includes('notify_event')) {
            acc.notifyIntegration.push(curr);
          } else {
            acc.notify.push(curr);
          }
          return acc;
        },
        {
          notify: [] as IssueAlertRuleActionTemplate[],
          notifyIntegration: [] as IssueAlertRuleActionTemplate[],
          ticket: [] as IssueAlertRuleActionTemplate[],
          change: [] as IssueAlertRuleConditionTemplate[],
          frequency: [] as IssueAlertRuleConditionTemplate[],
        }
      );

      options = Object.entries(grouped)
        .filter(([_, values]) => values.length)
        .map(([key, values]) => {
          const label = {
            notify: t('Send notification to\u{2026}'),
            notifyIntegration: t('Notify integration\u{2026}'),
            ticket: t('Create new\u{2026}'),
            change: t('Issue state change'),
            frequency: t('Issue frequency'),
          };

          return {label: label[key], options: createSelectOptions(values)};
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
  gap: ${space(1)};

  @media (max-width: ${p => p.theme.breakpoints[1]}) {
    grid-auto-flow: row;
  }
`;

const StyledFeatureBadge = styled(FeatureBadge)`
  margin: 0 ${space(1)} 0 0;
`;
