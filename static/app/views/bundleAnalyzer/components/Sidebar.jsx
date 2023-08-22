import {Component} from 'react';
import cls from 'classnames';

import Button from './Button';
import Icon from './Icon';
import s from './Sidebar.css';

const toggleTime = 200;

export default class Sidebar extends Component {
  static defaultProps = {
    pinned: false,
    position: 'left',
  };

  allowHide = true;
  toggling = false;
  hideContentTimeout = null;
  width = null;
  state = {
    visible: true,
    renderContent: true,
  };

  componentDidMount() {
    this.hideTimeoutId = setTimeout(() => this.toggleVisibility(false), 3000);
  }

  componentWillUnmount() {
    clearTimeout(this.hideTimeoutId);
    clearTimeout(this.hideContentTimeout);
  }

  render() {
    const {position, pinned, children} = this.props;
    const {visible, renderContent} = this.state;

    const className = cls({
      [s.container]: true,
      [s.pinned]: pinned,
      [s.left]: position === 'left',
      [s.hidden]: !visible,
      [s.empty]: !renderContent,
    });

    return (
      <div
        ref={this.saveNode}
        className={className}
        onClick={this.handleClick}
        onMouseLeave={this.handleMouseLeave}
      >
        {visible && (
          <Button
            type="button"
            title="Pin"
            className={s.pinButton}
            active={pinned}
            toggle
            onClick={this.handlePinButtonClick}
          >
            <Icon name="pin" size={13} />
          </Button>
        )}
        <Button
          type="button"
          title={visible ? 'Hide' : 'Show sidebar'}
          className={s.toggleButton}
          onClick={this.handleToggleButtonClick}
        >
          <Icon name="arrow-right" size={10} rotate={visible ? 180 : 0} />
        </Button>
        {pinned && visible && (
          <div className={s.resizer} onMouseDown={this.handleResizeStart} />
        )}
        <div
          className={s.content}
          onMouseEnter={this.handleMouseEnter}
          onMouseMove={this.handleMouseMove}
        >
          {renderContent ? children : null}
        </div>
      </div>
    );
  }

  handleClick = () => {
    this.allowHide = false;
  };

  handleMouseEnter = () => {
    if (!this.toggling && !this.props.pinned) {
      clearTimeout(this.hideTimeoutId);
      this.toggleVisibility(true);
    }
  };

  handleMouseMove = () => {
    this.allowHide = true;
  };

  handleMouseLeave = () => {
    if (this.allowHide && !this.toggling && !this.props.pinned) {
      this.toggleVisibility(false);
    }
  };

  handleToggleButtonClick = () => {
    this.toggleVisibility();
  };

  handlePinButtonClick = () => {
    const pinned = !this.props.pinned;
    this.width = pinned ? this.node.getBoundingClientRect().width : null;
    this.updateNodeWidth();
    this.props.onPinStateChange(pinned);
  };

  handleResizeStart = event => {
    this.resizeInfo = {
      startPageX: event.pageX,
      initialWidth: this.width,
    };
    document.body.classList.add('resizing', 'col');
    document.addEventListener('mousemove', this.handleResize, true);
    document.addEventListener('mouseup', this.handleResizeEnd, true);
  };

  handleResize = event => {
    this.width =
      this.resizeInfo.initialWidth + (event.pageX - this.resizeInfo.startPageX);
    this.updateNodeWidth();
  };

  handleResizeEnd = () => {
    document.body.classList.remove('resizing', 'col');
    document.removeEventListener('mousemove', this.handleResize, true);
    document.removeEventListener('mouseup', this.handleResizeEnd, true);
    this.props.onResize();
  };

  toggleVisibility(flag) {
    clearTimeout(this.hideContentTimeout);

    const {visible} = this.state;
    const {onToggle, pinned} = this.props;

    if (flag === undefined) {
      flag = !visible;
    } else if (flag === visible) {
      return;
    }

    this.setState({visible: flag});
    this.toggling = true;
    setTimeout(() => {
      this.toggling = false;
    }, toggleTime);

    if (pinned) {
      this.updateNodeWidth(flag ? this.width : null);
    }

    if (flag || pinned) {
      this.setState({renderContent: flag});
      onToggle(flag);
    } else if (!flag) {
      // Waiting for the CSS animation to finish and hiding content
      this.hideContentTimeout = setTimeout(() => {
        this.hideContentTimeout = null;
        this.setState({renderContent: false});
        onToggle(false);
      }, toggleTime);
    }
  }

  saveNode = node => (this.node = node);

  updateNodeWidth(width = this.width) {
    this.node.style.width = width ? `${width}px` : '';
  }
}
