import {Manager, Reference, Popper} from 'react-popper';
import * as PopperJS from 'popper.js';
import PropTypes from 'prop-types';
import React from 'react';
import ReactDOM from 'react-dom';
import styled from '@emotion/styled';
import memoize from 'lodash/memoize';

import {domId} from 'app/utils/domId';
import {IS_CI} from 'app/constants';

const IS_HOVERABLE_DELAY = 50; // used if isHoverable is true (for hiding AND showing)

type DefaultProps = {
  /**
   * Position for the tooltip.
   */
  position: PopperJS.Placement;

  /**
   * Display mode for the container element
   */
  containerDisplayMode: React.CSSProperties['display'];
};

type Props = DefaultProps & {
  /**
   * The node to attach the Tooltip to
   */
  children: React.ReactNode;

  /**
   * Disable the tooltip display entirely
   */
  disabled?: boolean;

  /**
   * The content to show in the tooltip popover
   */
  title: React.ReactNode;

  /**
   * Additional style rules for the tooltip content.
   */
  popperStyle?: React.CSSProperties;

  /**
   * Time to wait (in milliseconds) before showing the tooltip
   */
  delay?: number;

  /**
   * If true, user is able to hover tooltip without it disappearing.
   * (nice if you want to be able to copy tooltip contents to clipboard)
   */
  isHoverable?: boolean;

  /**
   * If child node supports ref forwarding, you can skip apply a wrapper
   */
  skipWrapper?: boolean;
};

type State = {
  isOpen: boolean;
  usesGlobalPortal: boolean;
};

class Tooltip extends React.Component<Props, State> {
  static propTypes = {
    disabled: PropTypes.bool,
    title: PropTypes.oneOfType([PropTypes.string, PropTypes.element]),
    position: PropTypes.oneOf([
      'bottom',
      'top',
      'left',
      'right',
      'bottom-start',
      'bottom-end',
      'top-start',
      'top-end',
      'left-start',
      'left-end',
      'right-start',
      'right-end',
      'auto',
    ]),
    popperStyle: PropTypes.oneOfType([PropTypes.string, PropTypes.object]),
    containerDisplayMode: PropTypes.string,
    delay: PropTypes.number,
    isHoverable: PropTypes.bool,
    skipWrapper: PropTypes.bool,
  };

  static defaultProps: DefaultProps = {
    position: 'top',
    containerDisplayMode: 'inline-block',
  };

  state: State = {
    isOpen: false,
    usesGlobalPortal: true,
  };

  async componentDidMount() {
    if (IS_CI) {
      const TooltipStore = (
        await import(/* webpackChunkName: "TooltipStore" */ 'app/stores/tooltipStore')
      ).default;
      TooltipStore.addTooltip(this);
    }
  }

  async componentWillUnmount() {
    const {usesGlobalPortal} = this.state;

    if (IS_CI) {
      const TooltipStore = (
        await import(/* webpackChunkName: "TooltipStore" */ 'app/stores/tooltipStore')
      ).default;
      TooltipStore.removeTooltip(this);
    }
    if (!usesGlobalPortal) {
      document.body.removeChild(this.getPortal(usesGlobalPortal));
    }
  }

  tooltipId: string = domId('tooltip-');
  delayTimeout: number | null = null;
  delayHideTimeout: number | null = null;

  getPortal = memoize(
    (usesGlobalPortal): HTMLElement => {
      if (usesGlobalPortal) {
        let portal = document.getElementById('tooltip-portal');
        if (!portal) {
          portal = document.createElement('div');
          portal.setAttribute('id', 'tooltip-portal');
          document.body.appendChild(portal);
        }
        return portal;
      }
      const portal = document.createElement('div');
      document.body.appendChild(portal);
      return portal;
    }
  );

  setOpen = () => {
    this.setState({isOpen: true});
  };

  setClose = () => {
    this.setState({isOpen: false});
  };

  handleOpen = () => {
    const {delay, isHoverable} = this.props;

    if (this.delayHideTimeout) {
      window.clearTimeout(this.delayHideTimeout);
      this.delayHideTimeout = null;
    }

    if (delay || isHoverable) {
      this.delayTimeout = window.setTimeout(this.setOpen, delay || IS_HOVERABLE_DELAY);
    } else {
      this.setOpen();
    }
  };

  handleClose = () => {
    const {isHoverable} = this.props;

    if (this.delayTimeout) {
      window.clearTimeout(this.delayTimeout);
      this.delayTimeout = null;
    }

    if (isHoverable) {
      this.delayHideTimeout = window.setTimeout(this.setClose, IS_HOVERABLE_DELAY);
    } else {
      this.setClose();
    }
  };

  renderTrigger(children: React.ReactNode, ref: React.Ref<HTMLElement>) {
    const propList: {[key: string]: any} = {
      'aria-describedby': this.tooltipId,
      onFocus: this.handleOpen,
      onBlur: this.handleClose,
      onMouseEnter: this.handleOpen,
      onMouseLeave: this.handleClose,
    };

    // Use the `type` property of the react instance to detect whether we
    // have a basic element (type=string) or a class/function component (type=function or object)
    // Because we can't rely on the child element implementing forwardRefs we wrap
    // it with a span tag so that popper has ref

    if (
      React.isValidElement(children) &&
      (this.props.skipWrapper || typeof children.type === 'string')
    ) {
      // Basic DOM nodes can be cloned and have more props applied.
      return React.cloneElement(children, {
        ...propList,
        ref,
      });
    }

    propList.containerDisplayMode = this.props.containerDisplayMode;
    return (
      <Container {...propList} ref={ref}>
        {children}
      </Container>
    );
  }

  render() {
    const {disabled, children, title, position, popperStyle, isHoverable} = this.props;
    const {isOpen, usesGlobalPortal} = this.state;
    if (disabled) {
      return children;
    }

    let tip: React.ReactPortal | null = null;
    const modifiers: PopperJS.Modifiers = {
      hide: {enabled: false},
      preventOverflow: {
        padding: 10,
        enabled: true,
        boundariesElement: 'viewport',
      },
    };

    if (isOpen) {
      tip = ReactDOM.createPortal(
        <Popper placement={position} modifiers={modifiers}>
          {({ref, style, placement, arrowProps}) => (
            <TooltipContent
              id={this.tooltipId}
              className="tooltip-content"
              aria-hidden={!isOpen}
              ref={ref}
              style={style}
              hide={!title}
              data-placement={placement}
              popperStyle={popperStyle}
              onMouseEnter={() => isHoverable && this.handleOpen()}
              onMouseLeave={() => isHoverable && this.handleClose()}
            >
              {title}
              <TooltipArrow
                ref={arrowProps.ref}
                data-placement={placement}
                style={arrowProps.style}
                background={popperStyle?.background || '#000'}
              />
            </TooltipContent>
          )}
        </Popper>,
        this.getPortal(usesGlobalPortal)
      );
    }

    return (
      <Manager>
        <Reference>{({ref}) => this.renderTrigger(children, ref)}</Reference>
        {tip}
      </Manager>
    );
  }
}

// Using an inline-block solves the container being smaller
// than the elements it is wrapping
const Container = styled('span')<{
  containerDisplayMode?: React.CSSProperties['display'];
}>`
  ${p => p.containerDisplayMode && `display: ${p.containerDisplayMode}`};
  max-width: 100%;
`;

const TooltipContent = styled('div')<{hide: boolean} & Pick<Props, 'popperStyle'>>`
  color: #fff;
  background: #000;
  opacity: 0.9;
  padding: 5px 10px;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.15);
  border-radius: ${p => p.theme.borderRadius};
  overflow-wrap: break-word;
  max-width: 225px;
  z-index: ${p => p.theme.zIndex.tooltip};

  font-weight: bold;
  font-size: ${p => p.theme.fontSizeSmall};
  line-height: 1.4;

  margin: 6px;
  text-align: center;
  ${p => p.popperStyle as any};
  ${p => p.hide && `display: none`};
`;

const TooltipArrow = styled('span')<{background: string | number}>`
  position: absolute;
  width: 10px;
  height: 5px;

  &[data-placement*='bottom'] {
    top: 0;
    left: 0;
    margin-top: -5px;
    &::before {
      border-width: 0 5px 5px 5px;
      border-color: transparent transparent ${p => p.background} transparent;
    }
  }

  &[data-placement*='top'] {
    bottom: 0;
    left: 0;
    margin-bottom: -5px;
    &::before {
      border-width: 5px 5px 0 5px;
      border-color: ${p => p.background} transparent transparent transparent;
    }
  }

  &[data-placement*='right'] {
    left: 0;
    margin-left: -5px;
    &::before {
      border-width: 5px 5px 5px 0;
      border-color: transparent ${p => p.background} transparent transparent;
    }
  }

  &[data-placement*='left'] {
    right: 0;
    margin-right: -5px;
    &::before {
      border-width: 5px 0 5px 5px;
      border-color: transparent transparent transparent ${p => p.background};
    }
  }

  &::before {
    content: '';
    margin: auto;
    display: block;
    width: 0;
    height: 0;
    border-style: solid;
  }
`;

export default Tooltip;
