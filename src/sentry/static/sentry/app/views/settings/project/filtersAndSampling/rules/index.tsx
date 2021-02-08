import React from 'react';
import styled from '@emotion/styled';

import {addErrorMessage} from 'app/actionCreators/indicator';
import {PanelTable} from 'app/components/panels';
import {t} from 'app/locale';
import overflowEllipsis from 'app/styles/overflowEllipsis';
import {DynamicSamplingRule, DynamicSamplingRuleType} from 'app/types/dynamicSampling';

import DraggableList, {UpdateItemsProps} from './draggableList';
import Rule from './rule';
import {layout} from './utils';

type Props = {
  rules: Array<DynamicSamplingRule>;
  disabled: boolean;
  onEditRule: (rule: DynamicSamplingRule) => () => void;
  onDeleteRule: (rule: DynamicSamplingRule) => () => void;
  onUpdateRules: (rules: Array<DynamicSamplingRule>) => void;
};

type RulesWithId = Array<DynamicSamplingRule & {id: string}>;

type State = {
  rules: RulesWithId;
};

class Rules extends React.PureComponent<Props, State> {
  state: State = {
    rules: [],
  };

  componentDidMount() {
    this.getRules();
  }

  componentDidUpdate(prevProps: Props) {
    if (prevProps.rules !== this.props.rules) {
      this.getRules();
    }
  }

  handleUpdateRulesParent() {
    const {onUpdateRules} = this.props;
    const {rules} = this.state;

    const reordered = rules.map(({id: _id, ...rule}) => rule);
    onUpdateRules(reordered);
  }

  handleUpdateRules = ({
    activeIndex,
    overIndex,
    reorderedItems: ruleIds,
  }: UpdateItemsProps) => {
    const {rules} = this.state;
    const reorderedRules = ruleIds
      .map(ruleId => rules.find(rule => rule.id === ruleId))
      .filter(rule => !!rule) as RulesWithId;

    const activeRuleType = rules[activeIndex].type;
    const overRuleType = rules[overIndex].type;

    if (
      activeRuleType === DynamicSamplingRuleType.TRACE &&
      overRuleType === DynamicSamplingRuleType.TRANSACTION
    ) {
      addErrorMessage(
        t('Transaction traces rules cannot be under individual transactions rules')
      );
      return;
    }

    if (
      activeRuleType === DynamicSamplingRuleType.TRANSACTION &&
      overRuleType === DynamicSamplingRuleType.TRACE
    ) {
      addErrorMessage(
        t('Individual transactions rules cannot be above transaction traces rules')
      );
      return;
    }

    this.setState({rules: reorderedRules}, this.handleUpdateRulesParent);
  };

  getRules() {
    const {rules} = this.props;
    const rulesWithId = rules.map((rule, index) => ({...rule, id: String(index)}));
    this.setState({rules: rulesWithId});
  }

  render() {
    const {onEditRule, onDeleteRule, disabled} = this.props;
    const {rules} = this.state;

    return (
      <StyledPanelTable
        headers={['', t('Type'), t('Conditions'), t('Rate'), '']}
        isEmpty={!rules.length}
        emptyMessage={t('There are no rules to display')}
      >
        <DraggableList
          disabled={disabled}
          items={rules.map(rule => rule.id)}
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
            const currentRule = rules.find(rule => rule.id === value);

            if (!currentRule) {
              return null;
            }

            const {id: _id, ...rule} = currentRule;

            return (
              <Rule
                rule={rule}
                onEditRule={onEditRule(rule)}
                onDeleteRule={onDeleteRule(rule)}
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
