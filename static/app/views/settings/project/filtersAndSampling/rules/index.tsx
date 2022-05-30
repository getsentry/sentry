import {PureComponent} from 'react';
import styled from '@emotion/styled';
import isEqual from 'lodash/isEqual';
import partition from 'lodash/partition';

import {addErrorMessage} from 'sentry/actionCreators/indicator';
import {PanelTable} from 'sentry/components/panels';
import {t} from 'sentry/locale';
import overflowEllipsis from 'sentry/styles/overflowEllipsis';
import {
  DynamicSamplingConditionOperator,
  DynamicSamplingRule,
  DynamicSamplingRuleType,
} from 'sentry/types/dynamicSampling';

import DraggableList, {UpdateItemsProps} from './draggableList';
import Rule from './rule';
import {layout} from './utils';

type Props = {
  disabled: boolean;
  emptyMessage: string;
  onDeleteRule: (rule: DynamicSamplingRule) => () => void;
  onEditRule: (rule: DynamicSamplingRule) => () => void;
  onUpdateRules: (rules: Array<DynamicSamplingRule>) => void;
  rules: Array<DynamicSamplingRule>;
};

type State = {
  rules: Array<DynamicSamplingRule>;
};

class Rules extends PureComponent<Props, State> {
  state: State = {rules: []};

  componentDidMount() {
    this.getRules();
  }

  componentDidUpdate(prevProps: Props) {
    if (!isEqual(prevProps.rules, this.props.rules)) {
      this.getRules();
      return;
    }

    if (!isEqual(this.props.rules, this.state.rules)) {
      this.handleUpdateRulesParent();
    }
  }

  getRules() {
    this.setState({rules: this.props.rules});
  }

  handleUpdateRulesParent() {
    const {onUpdateRules} = this.props;
    const {rules} = this.state;

    onUpdateRules(rules);
  }

  handleUpdateRules = ({
    activeIndex,
    overIndex,
    reorderedItems: ruleIds,
  }: UpdateItemsProps) => {
    const {rules} = this.state;
    const reorderedRules = ruleIds
      .map(ruleId => rules.find(rule => String(rule.id) === ruleId))
      .filter(rule => !!rule) as Array<DynamicSamplingRule>;

    const activeRule = rules[activeIndex];
    const overRule = rules[overIndex];

    if (
      activeRule.condition.op === DynamicSamplingConditionOperator.AND &&
      !activeRule.condition.inner.length
    ) {
      addErrorMessage(
        t('Rules with conditions cannot be below rules without conditions')
      );
      return;
    }

    if (
      activeRule.type === DynamicSamplingRuleType.TRACE &&
      overRule.type === DynamicSamplingRuleType.TRANSACTION
    ) {
      addErrorMessage(
        t('Transaction traces rules cannot be under individual transactions rules')
      );
      return;
    }

    if (
      activeRule.type === DynamicSamplingRuleType.TRANSACTION &&
      overRule.type === DynamicSamplingRuleType.TRACE
    ) {
      addErrorMessage(
        t('Individual transactions rules cannot be above transaction traces rules')
      );
      return;
    }

    this.setState({rules: reorderedRules});
  };

  render() {
    const {onEditRule, onDeleteRule, disabled, emptyMessage} = this.props;
    const {rules} = this.state;

    const [rulesWithConditions, rulesWithoutConditions] = partition(
      rules,
      rule => !!rule.condition.inner.length
    );

    // Rules without conditions always have to be 'pinned' to the bottom of the list
    const items = [
      ...rulesWithConditions.map(({id}) => ({id: String(id), disabled: false})),
      ...rulesWithoutConditions.map(({id}) => ({id: String(id), disabled: true})),
    ];

    return (
      <StyledPanelTable
        headers={['', t('Operator'), t('Conditions'), t('Rate'), '']}
        isEmpty={!rules.length}
        emptyMessage={emptyMessage}
      >
        <DraggableList
          disabled={disabled}
          items={items}
          onUpdateItems={this.handleUpdateRules}
          wrapperStyle={({isDragging, isSorting, index}) => {
            if (isDragging) {
              return {
                cursor: 'grabbing',
              };
            }
            if (isSorting) {
              return {};
            }
            return {
              transform: 'none',
              transformOrigin: '0',
              '--box-shadow': 'none',
              '--box-shadow-picked-up': 'none',
              overflow: 'visible',
              position: 'relative',
              zIndex: rules.length - index,
              cursor: 'default',
            };
          }}
          renderItem={({value, listeners, attributes, dragging, sorting}) => {
            const currentRule = rules.find(rule => String(rule.id) === value);

            if (!currentRule) {
              return null;
            }

            return (
              <Rule
                firstOnTheList={String(currentRule.id) === items[0].id}
                rule={currentRule}
                onEditRule={onEditRule(currentRule)}
                onDeleteRule={onDeleteRule(currentRule)}
                disabled={disabled}
                listeners={listeners}
                grabAttributes={attributes}
                dragging={dragging}
                sorting={sorting}
              />
            );
          }}
        />
      </StyledPanelTable>
    );
  }
}

export default Rules;

const StyledPanelTable = styled(PanelTable)`
  overflow: visible;
  margin-bottom: 0;
  border: none;
  border-bottom-right-radius: 0;
  border-bottom-left-radius: 0;
  ${p => layout(p.theme)}
  > * {
    ${overflowEllipsis};
    :not(:last-child) {
      border-bottom: 1px solid ${p => p.theme.border};
    }
    :nth-child(n + 6) {
      ${p =>
        !p.isEmpty
          ? `
              display: grid;
              grid-column: 1/-1;
              padding: 0;
            `
          : `
              display: block;
              grid-column: 1/-1;
            `}
    }
  }
`;
