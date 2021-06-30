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
    id: string
  ):
    | IssueAlertRuleActionTemplate
    | IssueAlertRuleConditionTemplate
    | null
    | undefined => {
    const {nodes} = this.props;
    return nodes ? nodes.find(node => node.id === id) : null;
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
        const isBeta = node.id === EVENT_FREQUENCY_PERCENT_CONDITION;
        return {
          value: node.id,
          label: (
            <React.Fragment>
              {isBeta && <StyledFeatureBadge type="beta" noTooltip />}
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
              node={this.getNode(item.id)}
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
