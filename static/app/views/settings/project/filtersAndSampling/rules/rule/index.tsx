import {Component} from 'react';
import {DraggableSyntheticListeners, UseDraggableArguments} from '@dnd-kit/core';
import {css} from '@emotion/react';
import styled from '@emotion/styled';

import Tooltip from 'sentry/components/tooltip';
import {IconGrabbable} from 'sentry/icons/iconGrabbable';
import {t} from 'sentry/locale';
import space from 'sentry/styles/space';
import {
  DynamicSamplingRule,
  DynamicSamplingRuleOperator,
} from 'sentry/types/dynamicSampling';

import {layout} from '../utils';

import Actions from './actions';
import Conditions from './conditions';

type Props = {
  dragging: boolean;
  listeners: DraggableSyntheticListeners;
  noPermission: boolean;
  onDeleteRule: () => void;
  onEditRule: () => void;
  operator: DynamicSamplingRuleOperator;
  rule: DynamicSamplingRule;
  sorting: boolean;
  grabAttributes?: UseDraggableArguments['attributes'];
};

type State = {
  isMenuActionsOpen: boolean;
};

class Rule extends Component<Props, State> {
  state: State = {
    isMenuActionsOpen: false,
  };

  componentDidMount() {
    this.checkMenuActionsVisibility();
  }

  componentDidUpdate() {
    this.checkMenuActionsVisibility();
  }

  checkMenuActionsVisibility() {
    const {dragging, sorting} = this.props;
    const {isMenuActionsOpen} = this.state;
    if ((dragging || sorting) && isMenuActionsOpen) {
      this.setState({isMenuActionsOpen: false});
    }
  }

  handleChangeMenuAction = () => {
    this.setState(state => ({
      isMenuActionsOpen: !state.isMenuActionsOpen,
    }));
  };

  render() {
    const {
      rule,
      noPermission,
      onEditRule,
      onDeleteRule,
      listeners,
      operator,
      grabAttributes,
    } = this.props;

    const {isMenuActionsOpen} = this.state;

    return (
      <Columns disabled={rule.disabled ?? noPermission}>
        <GrabColumn>
          <Tooltip
            title={
              noPermission
                ? t('You do not have permission to reorder rules.')
                : operator === DynamicSamplingRuleOperator.ELSE
                ? t('Rules without conditions cannot be reordered.')
                : undefined
            }
          >
            <IconGrabbableWrapper {...listeners} {...grabAttributes}>
              <IconGrabbable />
            </IconGrabbableWrapper>
          </Tooltip>
        </GrabColumn>
        <Column>
          <Operator>
            {operator === DynamicSamplingRuleOperator.IF
              ? t('If')
              : operator === DynamicSamplingRuleOperator.ELSE_IF
              ? t('Else if')
              : t('Else')}
          </Operator>
        </Column>
        <Column>
          <Conditions condition={rule.condition} />
        </Column>
        <CenteredColumn>
          <SampleRate>{`${rule.sampleRate * 100}\u0025`}</SampleRate>
        </CenteredColumn>
        <Column>
          <Actions
            onEditRule={onEditRule}
            onDeleteRule={onDeleteRule}
            disabled={noPermission}
            onOpenMenuActions={this.handleChangeMenuAction}
            isMenuActionsOpen={isMenuActionsOpen}
          />
        </Column>
      </Columns>
    );
  }
}

export default Rule;

const Operator = styled('div')`
  color: ${p => p.theme.active};
`;

const SampleRate = styled('div')`
  white-space: pre-wrap;
  word-break: break-all;
`;

const Column = styled('div')`
  display: flex;
  align-items: center;
  padding: ${space(2)};
  cursor: default;
  white-space: pre-wrap;
  word-break: break-all;
`;

const GrabColumn = styled(Column)`
  [role='button'] {
    cursor: grab;
  }
`;

const Columns = styled('div')<{disabled: boolean}>`
  display: grid;
  align-items: center;
  ${p => layout(p.theme)}
  > * {
    overflow: visible;
    :nth-child(5n) {
      justify-content: flex-end;
    }
  }

  ${p =>
    p.disabled &&
    css`
      ${Operator} {
        color: ${p.theme.disabled};
      }
      ${GrabColumn} {
        color: ${p.theme.disabled};
        [role='button'] {
          cursor: not-allowed;
        }
      }
    `}
`;

const IconGrabbableWrapper = styled('div')`
  outline: none;
`;

const CenteredColumn = styled(Column)`
  text-align: center;
  justify-content: center;
`;
