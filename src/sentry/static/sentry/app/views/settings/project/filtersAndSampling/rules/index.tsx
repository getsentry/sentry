import React from 'react';
import styled from '@emotion/styled';

import {PanelTable} from 'app/components/panels';
import {t} from 'app/locale';
import {DynamicSamplingRule} from 'app/types/dynamicSampling';

import DraggableList from './draggableList';
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

  handleUpdateRules = (ruleIds: Array<string>) => {
    const {rules} = this.state;
    const reorderedRules = ruleIds
      .map(ruleId => rules.find(rule => rule.id === ruleId))
      .filter(rule => !!rule) as RulesWithId;

    this.setState({rules: reorderedRules}, this.handleUpdateRulesParent);
  };

  getRules() {
    const {rules} = this.props;
    const rulesWithId = rules.map((rule, index) => ({...rule, id: String(index)}));
    this.setState({rules: rulesWithId});
  }

  render() {
    const {onEditRule, disabled, onDeleteRule} = this.props;
    const {rules} = this.state;

    return (
      <StyledPanelTable
        headers={['', t('Type'), t('Category'), t('Sampling Rate'), '']}
        isEmpty={!rules.length}
        emptyMessage={t('There are no rules to display')}
      >
        <DraggableList
          items={rules.map(rule => rule.id)}
          onUpdateItems={this.handleUpdateRules}
          renderItem={({
            value,
            listeners,
            attributes,
            forwardRef,
            transform,
            transition,
            style: grabStyle,
          }) => {
            const currentRule = rules.find(rule => rule.id === value);

            if (!currentRule) {
              return null;
            }

            const style = {
              transition,
              '--translate-x': transform ? `${Math.round(transform.x)}px` : undefined,
              '--translate-y': transform ? `${Math.round(transform.y)}px` : undefined,
              '--scale-x': transform?.scaleX ? `${transform.scaleX}` : undefined,
              '--scale-y': transform?.scaleY ? `${transform.scaleY}` : undefined,
            } as React.CSSProperties;

            const {id: _id, ...rule} = currentRule;

            return (
              <Rule
                rule={rule}
                onEditRule={onEditRule(rule)}
                onDeleteRule={onDeleteRule(rule)}
                disabled={disabled}
                rootStyle={style}
                grabStyle={grabStyle}
                forwardRef={forwardRef as React.Ref<HTMLDivElement> | undefined}
                listeners={listeners}
                grabAttributes={attributes}
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
    :not(:last-child),
    :nth-child(-n + 6):not(:last-child) {
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
