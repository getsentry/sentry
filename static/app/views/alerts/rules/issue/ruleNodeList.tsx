import type React from 'react';
import {Component, Fragment, type ReactNode} from 'react';
import styled from '@emotion/styled';

import SelectControl from 'sentry/components/forms/controls/selectControl';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {
  IssueAlertConfiguration,
  IssueAlertGenericConditionConfig,
  IssueAlertRuleAction,
  IssueAlertRuleActionTemplate,
  IssueAlertRuleCondition,
  IssueAlertRuleConditionTemplate,
} from 'sentry/types/alerts';
import {IssueAlertActionType, IssueAlertConditionType} from 'sentry/types/alerts';
import type {Organization} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';
import {
  CHANGE_ALERT_CONDITION_IDS,
  COMPARISON_INTERVAL_CHOICES,
  COMPARISON_TYPE_CHOICE_VALUES,
  COMPARISON_TYPE_CHOICES,
} from 'sentry/views/alerts/utils/constants';

import {AlertRuleComparisonType} from '../metric/types';

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
  nodes: IssueAlertConfiguration[keyof IssueAlertConfiguration] | null;
  onAddRow: (
    value: IssueAlertRuleActionTemplate | IssueAlertRuleConditionTemplate
  ) => void;
  onDeleteRow: (ruleIndex: number) => void;
  onPropertyChange: (ruleIndex: number, prop: string, val: string) => void;
  onResetRow: (ruleIndex: number, name: string, value: string) => void;
  organization: Organization;
  /**
   * Placeholder for select control
   */
  placeholder: string;
  project: Project;
  additionalAction?: {
    label: ReactNode;
    onClick: () => void;
    option: {
      label: ReactNode;
      value: IssueAlertRuleActionTemplate;
    };
  };
  incompatibleBanner?: number | null;
  incompatibleRules?: number[] | null;
  selectType?: 'grouped';
};

const createSelectOptions = (
  actions: IssueAlertRuleActionTemplate[]
): Array<{
  label: React.ReactNode;
  value: IssueAlertRuleActionTemplate;
}> => {
  return actions.map(node => {
    if (node.id === IssueAlertActionType.NOTIFY_EMAIL) {
      const label = t('Suggested Assignees, Team, or Member');
      return {
        value: node,
        label,
      };
    }

    if (node.id === IssueAlertConditionType.REAPPEARED_EVENT) {
      const label = t('The issue changes state from archived to escalating');
      return {
        value: node,
        label,
      };
    }

    return {
      value: node,
      label: node.prompt ?? node.label,
    };
  });
};

const groupLabels = {
  notify: t('Send notification to\u{2026}'),
  notifyIntegration: t('Notify integration\u{2026}'),
  ticket: t('Create new\u{2026}'),
  change: t('Issue state change'),
  frequency: t('Issue frequency'),
};

/**
 * Group options by category
 */
const groupSelectOptions = (actions: IssueAlertRuleActionTemplate[]) => {
  const grouped = actions.reduce<
    Record<
      keyof typeof groupLabels,
      IssueAlertRuleActionTemplate[] | IssueAlertRuleConditionTemplate[]
    >
  >(
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
      notify: [],
      notifyIntegration: [],
      ticket: [],
      change: [],
      frequency: [],
    }
  );

  return Object.entries(grouped)
    .filter(([_, values]) => values.length)
    .map(([key, values]) => {
      return {
        // @ts-ignore TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
        label: groupLabels[key],
        options: createSelectOptions(values),
      };
    });
};

class RuleNodeList extends Component<Props> {
  componentWillUnmount() {
    window.clearTimeout(this.propertyChangeTimeout);
  }

  propertyChangeTimeout: number | undefined = undefined;

  getNode = (
    template: IssueAlertRuleAction | IssueAlertRuleCondition,
    itemIdx: number
  ): IssueAlertConfiguration[keyof IssueAlertConfiguration][number] | null => {
    const {nodes, items, organization, onPropertyChange} = this.props;
    const node = nodes?.find((n: any) => {
      if ('sentryAppInstallationUuid' in n) {
        // Match more than just the id for sentryApp actions, they share the same id
        return (
          n.id === template.id &&
          n.sentryAppInstallationUuid === template.sentryAppInstallationUuid
        );
      }

      return n.id === template.id;
    });

    if (!node) {
      return null;
    }

    if (
      !organization.features.includes('change-alerts') ||
      !CHANGE_ALERT_CONDITION_IDS.includes(node.id)
    ) {
      return node;
    }

    const item = items[itemIdx]!;

    let changeAlertNode: IssueAlertGenericConditionConfig = {
      ...(node as IssueAlertGenericConditionConfig),
      label: node.label.replace('...', ' {comparisonType}'),
      formFields: {
        ...(node.formFields as IssueAlertGenericConditionConfig['formFields']),
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
          // @ts-ignore TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
          COMPARISON_TYPE_CHOICE_VALUES[item.comparisonType]
        ),
      };

      if (item.comparisonType === AlertRuleComparisonType.PERCENT) {
        if (!item.comparisonInterval) {
          // comparisonInterval value in IssueRuleEditor state
          // is undefined even if initial value is defined
          // can't directly call onPropertyChange, because
          // getNode is called during render
          window.clearTimeout(this.propertyChangeTimeout);
          this.propertyChangeTimeout = window.setTimeout(() =>
            onPropertyChange(itemIdx, 'comparisonInterval', '1w')
          );
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
      additionalAction,
      nodes,
      placeholder,
      items,
      organization,
      project,
      disabled,
      error,
      selectType,
      incompatibleRules,
      incompatibleBanner,
    } = this.props;

    const enabledNodes = nodes ? nodes.filter(({enabled}: any) => enabled) : [];

    let options: any[];
    if (selectType === 'grouped') {
      options = groupSelectOptions(enabledNodes);
      if (additionalAction) {
        const optionToModify = options.find(
          option => option.label === additionalAction.label
        );
        if (optionToModify) {
          optionToModify.options.push(additionalAction.option);
        }
      }
    } else {
      options = createSelectOptions(enabledNodes);
    }

    return (
      <Fragment>
        <RuleNodes>
          {error}
          {items.map(
            (item: IssueAlertRuleAction | IssueAlertRuleCondition, idx: number) => (
              <RuleNode
                key={idx}
                index={idx}
                node={this.getNode(item, idx)}
                onDelete={onDeleteRow}
                onPropertyChange={onPropertyChange}
                onReset={onResetRow}
                data={item}
                organization={organization}
                project={project}
                disabled={disabled}
                incompatibleRule={incompatibleRules?.includes(idx)}
                incompatibleBanner={incompatibleBanner === idx}
              />
            )
          )}
        </RuleNodes>

        <StyledSelectControl
          placeholder={placeholder}
          value={null}
          onChange={(obj: any) => {
            if (additionalAction && obj === additionalAction.option) {
              additionalAction.onClick();
            } else {
              onAddRow(obj.value);
            }
          }}
          options={options}
          disabled={disabled}
        />
      </Fragment>
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

  @media (max-width: ${p => p.theme.breakpoints.medium}) {
    grid-auto-flow: row;
  }
`;
