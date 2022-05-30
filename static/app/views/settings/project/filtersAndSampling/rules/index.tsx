import {PureComponent} from 'react';
import styled from '@emotion/styled';
import isEqual from 'lodash/isEqual';

import {addErrorMessage} from 'sentry/actionCreators/indicator';
import {PanelTable} from 'sentry/components/panels';
import {t} from 'sentry/locale';
import overflowEllipsis from 'sentry/styles/overflowEllipsis';
import {DynamicSamplingRule, DynamicSamplingRuleType} from 'sentry/types/dynamicSampling';

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

    this.setState({rules: reorderedRules});
  };

  render() {
    const {onEditRule, onDeleteRule, disabled, emptyMessage} = this.props;
    const {rules} = this.state;

    return (
      <StyledPanelTable
        headers={['', t('Operator'), t('Conditions'), t('Rate'), '']}
        isEmpty={!rules.length}
        emptyMessage={emptyMessage}
      >
        <DraggableList
          disabled={disabled}
          items={rules.map(rule => String(rule.id))}
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
                firstOnTheList={currentRule.id === rules[0].id}
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
