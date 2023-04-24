import {Component} from 'react';
import styled from '@emotion/styled';

import {IconArrow} from 'sentry/icons';
import {space} from 'sentry/styles/space';
import {trackAnalytics} from 'sentry/utils/analytics';

type NumberDragControlProps = {
  onChange: (delta: number, event: React.MouseEvent<HTMLDivElement>) => void;
  axis?: 'x' | 'y';
  /**
   * The value to increment by if the shift key is held. Defaults to 1
   */
  shiftStep?: number;
  /**
   * The value to increment by as the mouse is dragged. Defaults to 1
   */
  step?: number;
};

type Props = Omit<React.HTMLAttributes<HTMLDivElement>, keyof NumberDragControlProps> &
  NumberDragControlProps;

type State = {
  isClicked: boolean;
};

class NumberDragControl extends Component<Props, State> {
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
          trackAnalytics('number_drag_control.clicked', {
            organization: null,
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
        <IconArrow direction={isX ? 'left' : 'up'} legacySize="8px" />
        <IconArrow direction={isX ? 'right' : 'down'} legacySize="8px" />
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
  color: ${p => (p.isActive ? p.theme.gray500 : p.theme.gray300)};
  background: ${p => p.isActive && p.theme.backgroundSecondary};
  border-radius: 2px;
`;

export default NumberDragControl;
