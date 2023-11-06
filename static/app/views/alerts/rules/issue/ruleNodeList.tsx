import {Component, Fragment} from 'react';
import styled from '@emotion/styled';

import SelectControl from 'sentry/components/forms/controls/selectControl';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {IssueOwnership, Organization, Project} from 'sentry/types';
import {
  IssueAlertActionType,
  IssueAlertConditionType,
  IssueAlertConfiguration,
  IssueAlertGenericConditionConfig,
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
} from 'sentry/views/alerts/utils/constants';

import {AlertRuleComparisonType} from '../metric/types';

import RuleNode, {hasStreamlineTargeting} from './ruleNode';

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
  incompatibleBanner?: number | null;
  incompatibleRules?: number[] | null;
  ownership?: null | IssueOwnership;
  selectType?: 'grouped';
};

const createSelectOptions = (
  actions: IssueAlertRuleActionTemplate[],
  organization: Organization
): Array<{
  label: React.ReactNode;
  value: IssueAlertRuleActionTemplate;
}> => {
  return actions.map(node => {
    if (node.id === IssueAlertActionType.NOTIFY_EMAIL) {
      let label = t('Issue Owners, Team, or Member');
      if (hasStreamlineTargeting(organization)) {
        label = t('Suggested Assignees, Team, or Member');
      }
      return {
        value: node,
        label,
      };
    }

    if (
      node.id === IssueAlertConditionType.REAPPEARED_EVENT &&
      organization.features.includes('escalating-issues')
    ) {
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
const groupSelectOptions = (
  actions: IssueAlertRuleActionTemplate[],
  organization: Organization
) => {
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
        label: groupLabels[key],
        options: createSelectOptions(values, organization),
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
    const node = nodes?.find(n => {
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

    const item = items[itemIdx];

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
      nodes,
      placeholder,
      items,
      organization,
      ownership,
      project,
      disabled,
      error,
      selectType,
      incompatibleRules,
      incompatibleBanner,
    } = this.props;

    const enabledNodes = nodes ? nodes.filter(({enabled}) => enabled) : [];

    const options =
      selectType === 'grouped'
        ? groupSelectOptions(enabledNodes, organization)
        : createSelectOptions(enabledNodes, organization);

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
                ownership={ownership}
                incompatibleRule={incompatibleRules?.includes(idx)}
                incompatibleBanner={incompatibleBanner === idx}
              />
            )
          )}
        </RuleNodes>
        <StyledSelectControl
          placeholder={placeholder}
          value={null}
          onChange={obj => {
            onAddRow(obj.value);
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
