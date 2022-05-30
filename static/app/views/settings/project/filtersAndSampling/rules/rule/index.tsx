import {Component} from 'react';
import {DraggableSyntheticListeners, UseDraggableArguments} from '@dnd-kit/core';
import {css} from '@emotion/react';
import styled from '@emotion/styled';

import Tooltip from 'sentry/components/tooltip';
import {IconGrabbable} from 'sentry/icons/iconGrabbable';
import {t} from 'sentry/locale';
import space from 'sentry/styles/space';
import {
  DynamicSamplingConditionOperator,
  DynamicSamplingRule,
} from 'sentry/types/dynamicSampling';

import {layout} from '../utils';

import Actions from './actions';
import Conditions from './conditions';
import SampleRate from './sampleRate';

type Props = {
  disabled: boolean;
  dragging: boolean;
  firstOnTheList: boolean;
  listeners: DraggableSyntheticListeners;
  onDeleteRule: () => void;
  onEditRule: () => void;
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
      disabled,
      onEditRule,
      onDeleteRule,
      listeners,
      firstOnTheList,
      grabAttributes,
    } = this.props;

    const {condition, sampleRate} = rule;
    const {isMenuActionsOpen} = this.state;

    const sampleAll =
      condition.op === DynamicSamplingConditionOperator.AND && !condition.inner.length;

    return (
      <Columns>
        <GrabColumn disabled={sampleAll || disabled}>
          <Tooltip
            title={
              disabled
                ? t('You do not have permission to reorder rules.')
                : sampleAll
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
          <Operator disabled={sampleAll}>
            {sampleAll ? t('Else') : firstOnTheList ? t('If') : t('Else if')}
          </Operator>
        </Column>
        <Column>
          <Conditions condition={condition} />
        </Column>
        <CenteredColumn>
          <SampleRate sampleRate={sampleRate} />
        </CenteredColumn>
        <Column>
          <Actions
            onEditRule={onEditRule}
            onDeleteRule={onDeleteRule}
            disabled={disabled}
            onOpenMenuActions={this.handleChangeMenuAction}
            isMenuActionsOpen={isMenuActionsOpen}
          />
        </Column>
      </Columns>
    );
  }
}

export default Rule;

const Columns = styled('div')`
  display: grid;
  align-items: center;
  ${p => layout(p.theme)}
  > * {
    overflow: visible;
    :nth-child(5n) {
      justify-content: flex-end;
    }
  }
`;

const Column = styled('div')`
  display: flex;
  align-items: center;
  padding: ${space(2)};
  cursor: default;
  white-space: pre-wrap;
  word-break: break-all;
`;

const IconGrabbableWrapper = styled('div')`
  outline: none;
`;

const GrabColumn = styled(Column)<{disabled: boolean}>`
  cursor: inherit;
  ${p =>
    p.disabled
      ? css`
          ${IconGrabbableWrapper} {
            color: ${p.theme.disabled};
            cursor: not-allowed;
          }
        `
      : css`
          [role='button'] {
            cursor: grab;
          }
        `}
`;

const Operator = styled('div')<{disabled: boolean}>`
  color: ${p => (p.disabled ? p.theme.disabled : p.theme.active)};
`;

const CenteredColumn = styled(Column)`
  text-align: center;
  justify-content: center;
`;
