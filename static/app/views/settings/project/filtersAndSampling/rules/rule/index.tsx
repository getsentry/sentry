import {Component} from 'react';
import {DraggableSyntheticListeners, UseDraggableArguments} from '@dnd-kit/core';
import styled from '@emotion/styled';

import Tooltip from 'app/components/tooltip';
import {IconGrabbable} from 'app/icons/iconGrabbable';
import {t} from 'app/locale';
import space from 'app/styles/space';
import {DynamicSamplingRule} from 'app/types/dynamicSampling';

import {layout} from '../utils';

import Actions from './actions';
import Conditions from './conditions';
import SampleRate from './sampleRate';
import Type from './type';

type Props = {
  rule: DynamicSamplingRule;
  disabled: boolean;
  dragging: boolean;
  sorting: boolean;
  listeners: DraggableSyntheticListeners;
  onEditRule: () => void;
  onDeleteRule: () => void;
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
    const {rule, onEditRule, onDeleteRule, disabled, listeners, grabAttributes} =
      this.props;

    const {type, condition, sampleRate} = rule;
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
          <Type type={type} />
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
`;

const GrabColumn = styled(Column)`
  cursor: inherit;
  [role='button'] {
    cursor: grab;
  }
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
