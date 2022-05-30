import {Component} from 'react';
import {DraggableSyntheticListeners, UseDraggableArguments} from '@dnd-kit/core';
import styled from '@emotion/styled';

import Tooltip from 'sentry/components/tooltip';
import {IconGrabbable} from 'sentry/icons/iconGrabbable';
import {t} from 'sentry/locale';
import space from 'sentry/styles/space';
import {DynamicSamplingRule} from 'sentry/types/dynamicSampling';

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
      onEditRule,
      onDeleteRule,
      disabled,
      listeners,
      firstOnTheList,
      grabAttributes,
    } = this.props;

    const {condition, sampleRate} = rule;
    const {isMenuActionsOpen} = this.state;

    return (
      <Columns>
        <GrabColumn>
          <Tooltip
            title={
              disabled
                ? t('You do not have permission to reorder dynamic sampling rules.')
                : undefined
            }
          >
            <IconGrabbableWrapper {...listeners} disabled={disabled} {...grabAttributes}>
              <IconGrabbable />
            </IconGrabbableWrapper>
          </Tooltip>
        </GrabColumn>
        <Column>
          <Operator>{firstOnTheList ? t('If') : t('Else if')}</Operator>
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

const GrabColumn = styled(Column)`
  cursor: inherit;
  [role='button'] {
    cursor: grab;
  }
`;

const Operator = styled('div')`
  color: ${p => p.theme.purple300};
`;

const CenteredColumn = styled(Column)`
  text-align: center;
  justify-content: center;
`;

const IconGrabbableWrapper = styled('div')<{disabled: boolean}>`
  ${p =>
    p.disabled &&
    `
    color: ${p.theme.disabled};
    cursor: not-allowed;
  `};
  outline: none;
`;
