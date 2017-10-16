import PropTypes from 'prop-types';
import React from 'react';
import classNames from 'classnames';

class DropdownLink extends React.Component {
  static propTypes = {
    title: PropTypes.node,
    /** display dropdown caret */
    caret: PropTypes.bool,
    disabled: PropTypes.bool,
    onOpen: PropTypes.func,
    onClose: PropTypes.func,
    /**
     * If this is set, then this will become a "controlled" component.
     * It will no longer set local state and dropdown visiblity will
     * only follow `isOpen`.
     */
    isOpen: PropTypes.bool,
    /** anchors menu to the right */
    anchorRight: PropTypes.bool,
    /** Keeps dropdown menu open when menu is clicked */
    keepMenuOpen: PropTypes.bool,

    /**
     * Always render children of dropdown menu, this is included to support
     * menu items that open a confirm modal. Otherwise when dropdown menu hides,
     * the modal also gets unmounted
     */
    alwaysRenderMenu: PropTypes.bool,

    topLevelClasses: PropTypes.string,
    menuClasses: PropTypes.string
  };

  static defaultProps = {
    disabled: false,
    anchorRight: false,
    keepMenuOpen: false,
    caret: true
  };

  constructor(...args) {
    super(...args);
    this.state = {
      isOpen: false
    };
  }

  componentWillUnmount() {
    $(document).off('click', this.checkClickOutside);
  }

  // Gets open state from props or local state when appropriate
  isOpen = () => {
    let {isOpen} = this.props;
    let isControlled = typeof isOpen !== 'undefined';
    return (isControlled && isOpen) || this.state.isOpen;
  };

  // Checks if click happens inside of dropdown menu (or its button)
  // Closes dropdownmenu if it is "outside"
  checkClickOutside = e => {
    if (!this.dropdownMenu) return;
    // Dropdown menu itself
    if (this.dropdownMenu.contains(e.target)) return;
    // Button that controls visibility of dropdown menu
    if (this.dropdownActor.contains(e.target)) return;

    this.handleClose(e);
  };

  // Opens dropdown menu
  handleOpen = e => {
    let {onOpen, isOpen} = this.props;
    let isControlled = typeof isOpen !== 'undefined';
    if (!isControlled) {
      this.setState({
        isOpen: true
      });
    }

    if (typeof onOpen === 'function') {
      onOpen(e);
    }
  };

  // Closes dropdown menu
  handleClose = e => {
    let {onClose, isOpen} = this.props;
    let isControlled = typeof isOpen !== 'undefined';
    if (!isControlled) {
      this.setState({isOpen: false});
    }

    if (typeof onClose === 'function') {
      onClose(e);
    }
  };

  // When dropdown menu is displayed and mounted to DOM,
  // bind a click handler to `document` to listen for clicks outside of
  // this component and close menu if so
  handleMenuMount = ref => {
    this.dropdownMenu = ref;

    if (this.dropdownMenu) {
      $(document).on('click', this.checkClickOutside);
    } else {
      $(document).off('click', this.checkClickOutside);
    }
  };

  handleToggle = e => {
    if (this.isOpen()) {
      this.handleClose(e);
    } else {
      this.handleOpen(e);
    }
  };

  // Control whether we should hide dropdown menu when it is clicked
  handleDropdownMenuClick = e => {
    if (this.props.keepMenuOpen) return;

    this.handleClose(e);
  };

  render() {
    let {
      anchorRight,
      disabled,
      title,
      caret,
      children,
      menuClasses,
      className,
      alwaysRenderMenu,
      topLevelClasses
    } = this.props;

    // Default anchor = left
    let isRight = anchorRight;
    let shouldShowDropdown = this.isOpen();

    let cx = classNames('dropdown-actor', className, {
      'dropdown-menu-right': isRight,
      'dropdown-toggle': true,
      disabled
    });

    let topLevelCx = classNames('dropdown', topLevelClasses, {
      'pull-right': isRight,
      'anchor-right': isRight,
      open: shouldShowDropdown
    });

    return (
      <span className={topLevelCx}>
        <a
          className={cx}
          ref={ref => (this.dropdownActor = ref)}
          onClick={this.handleToggle}>
          {title}
          {caret && <i className="icon-arrow-down" />}
        </a>
        {(shouldShowDropdown || alwaysRenderMenu) &&
          <ul
            ref={this.handleMenuMount}
            onClick={this.handleDropdownMenuClick}
            className={classNames(menuClasses, 'dropdown-menu')}>
            {children}
          </ul>}
      </span>
    );
  }
}

export default DropdownLink;
