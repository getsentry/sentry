import React from 'react';
import styled from '@emotion/styled';

import {IconArrow} from 'app/icons';
import space from 'app/styles/space';
import {trackAnalyticsEvent} from 'app/utils/analytics';

type NumberDragControlProps = {
  onChange: (delta: number, event: React.MouseEvent<HTMLDivElement>) => void;
  axis?: 'x' | 'y';
  /**
   * The value to increment by as the mouse is dragged. Defaults to 1
   */
  step?: number;
  /**
   * The value to increment by if the shift key is held. Defaults to 1
   */
  shiftStep?: number;
};

type Props = Omit<React.HTMLAttributes<HTMLDivElement>, keyof NumberDragControlProps> &
  NumberDragControlProps;

type State = {
  isClicked: boolean;
};

class NumberDragControl extends React.Component<Props, State> {
  state: State = {
    isClicked: false,
  };

  render() {
    const {onChange, axis, step, shiftStep, ...props} = this.props;
    const isX = (axis ?? 'x') === 'x';

    return (
      <Wrapper
        {...props}
        onMouseDown={(event: React.MouseEvent<HTMLDivElement>) => {
          if (event.button !== 0) {
            return;
          }

          // XXX(epurkhiser): We can remove this later, just curious if people
          // are actually using the drag control
          trackAnalyticsEvent({
            eventName: 'Number Drag Control: Clicked',
            eventKey: 'number_drag_control.clicked',
          });

          event.currentTarget.requestPointerLock();
          this.setState({isClicked: true});
        }}
        onMouseUp={() => {
          document.exitPointerLock();
          this.setState({isClicked: false});
        }}
        onMouseMove={(event: React.MouseEvent<HTMLDivElement>) => {
          if (!this.state.isClicked) {
            return;
          }
          const delta = isX ? event.movementX : event.movementY * -1;
          const deltaOne = delta > 0 ? Math.ceil(delta / 100) : Math.floor(delta / 100);
          const deltaStep = deltaOne * ((event.shiftKey ? shiftStep : step) ?? 1);

          onChange(deltaStep, event);
        }}
        isActive={this.state.isClicked}
        isX={isX}
      >
        <IconArrow direction={isX ? 'left' : 'up'} size="8px" />
        <IconArrow direction={isX ? 'right' : 'down'} size="8px" />
      </Wrapper>
    );
  }
}

const Wrapper = styled('div')<{isActive: boolean; isX: boolean}>`
  display: grid;
  padding: ${space(0.5)};
  ${p =>
    p.isX
      ? 'grid-template-columns: max-content max-content'
      : 'grid-template-rows: max-content max-content'};
  cursor: ${p => (p.isX ? 'ew-resize' : 'ns-resize')};
  color: ${p => (p.isActive ? p.theme.gray800 : p.theme.gray500)};
  background: ${p => p.isActive && p.theme.gray200};
  border-radius: 2px;
`;

export default NumberDragControl;
