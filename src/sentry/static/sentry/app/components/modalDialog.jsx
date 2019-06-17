import React from 'react';
import styled from 'react-emotion';
import PropTypes from 'prop-types';

import InlineSvg from 'app/components/inlineSvg';
import space from 'app/styles/space';
import {callIfFunction} from 'app/utils/callIfFunction';

/**
 * Simple/Naive implementation of a dialog/modal window.
 *
 * The API this component exposes is intentionally compatible with
 * reach-ui/dialog as in the near future we should replace this component
 * with that library. This implementation doesn't handle
 * focus-lock and has poorer accessibility support.
 */
class ModalDialog extends React.Component {
  static propTypes = {
    /**
     * Function that returns the close button element
     * will be passed an object of options with `handleDismiss`
     * event handler for closing the modal
     */
    dismissButton: PropTypes.func,

    /**
     * Callback invoked when the modal is closed if set.
     */
    onDismiss: PropTypes.func.isRequired,

    /**
     * Whether or not the modal should display open.
     */
    isOpen: PropTypes.bool,

    className: PropTypes.string,
  };

  static defaultProps = {
    isOpen: true,
  };

  handleClose = event => {
    event.preventDefault();
    callIfFunction(this.props.onDismiss);
  };

  renderDismiss() {
    const {dismissButton} = this.props;
    if (dismissButton) {
      return dismissButton({handleDismiss: this.handleClose});
    }
    return <DismissButton onClick={this.handleClose} size={30} />;
  }

  render() {
    const {isOpen, children, className} = this.props;

    if (!isOpen) {
      return null;
    }

    return (
      <ModalScrollTrap>
        <ModalOverlay />
        <ModalContainer aria-modal="true" className={className}>
          {this.renderDismiss()}
          {children}
        </ModalContainer>
      </ModalScrollTrap>
    );
  }
}

const ModalOverlay = styled('div')`
  position: fixed;
  top: 0px;
  left: 0px;
  right: 0px;
  bottom: 0px;
  background: ${p => p.theme.foreground};
  opacity: 0.5;
  z-index: ${p => p.theme.zIndex.modal};
`;

const ModalScrollTrap = styled('div')`
  position: fixed;
  top: 0px;
  left: 0px;
  right: 0px;
  bottom: 0px;
  overflow-x: hidden;
  overflow-y: auto;
  z-index: ${p => p.theme.zIndex.modal};
`;

// Define some basic styling. Each modal usage
// can pass a className prop with more styles.
const ModalContainer = styled('div')`
  position: absolute;
  background: #fff;

  margin: ${space(3)};
  padding: ${space(3)};

  border: 1px solid ${p => p.theme.borderLight};
  border-radius: ${p => p.theme.borderRadius};
  box-shadow: ${p => p.theme.dropShadowHeavy};

  z-index: ${p => p.theme.zIndex.modal};
`;

const CircleButton = styled('button')`
  background: #fff;
  border-radius: ${p => p.size / 2}px;
  padding: ${p => p.size / 4}px;
  line-height: ${p => p.size * 0.4}px;
  height: ${p => p.size}px;
  box-shadow: ${p => p.theme.dropShadowLight};
  border: 1px solid ${p => p.theme.borderDark};

  position: absolute;
  top: -${p => p.size / 2}px;
  right: -${p => p.size / 2}px;
`;

const DismissButton = props => {
  const iconSize = props.size * 0.4;
  return (
    <CircleButton size={props.size} onClick={props.onClick}>
      <InlineSvg src="icon-close" size={`${iconSize}px`} />
    </CircleButton>
  );
};
DismissButton.propTypes = {
  onClick: PropTypes.func,
  size: PropTypes.number.isRequired,
};

export default ModalDialog;
