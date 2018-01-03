import React from 'react';
import PropTypes from 'prop-types';

class DropdownMenu extends React.Component {
  static propTypes = {
    onOpen: PropTypes.func,
    onClose: PropTypes.func,
    /**
     * Callback for when we get a click outside of dropdown menus.
     * Useful for when menu is controlled.
     */
    onClickOutside: PropTypes.func,

    /**
     * Callback function to check if we should ignore click outside to
     * hide dropdown menu
     */
    shouldIgnoreClickOutside: PropTypes.func,

    /**
     * If this is set, then this will become a "controlled" component.
     * It will no longer set local state and dropdown visiblity will
     * only follow `isOpen`.
     */
    isOpen: PropTypes.bool,

    /** Keeps dropdown menu open when menu is clicked */
    keepMenuOpen: PropTypes.bool,

    /**
     * If this is set to true, the dropdown behaves as a "nested dropdown" and is
     * triggered on mouse enter and mouse leave
     */
    isNestedDropdown: PropTypes.bool,
  };

  static defaultProps = {
    keepMenuOpen: false,
  };

  constructor(...args) {
    super(...args);
    this.state = {
      isOpen: false,
    };
  }

  componentWillUnmount() {
    document.removeEventListener('click', this.checkClickOutside, true);
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
    let {onClickOutside, shouldIgnoreClickOutside} = this.props;

    if (!this.dropdownMenu) return;
    // Dropdown menu itself
    if (this.dropdownMenu.contains(e.target)) return;
    // Button that controls visibility of dropdown menu
    if (this.dropdownActor.contains(e.target)) return;

    if (typeof shouldIgnoreClickOutside === 'function' && shouldIgnoreClickOutside(e))
      return;

    if (typeof onClickOutside === 'function') {
      onClickOutside(e);
    }

    this.handleClose(e);
  };

  // Callback function from <DropdownMenu> to see if we should close menu
  shouldIgnoreClickOutside = e => {
    let {shouldIgnoreClickOutside} = this.props;
    if (this.dropdownActor.contains(e.target)) return true;
    if (typeof shouldIgnoreClickOutside === 'function') {
      return shouldIgnoreClickOutside(e);
    }

    return false;
  };

  // Opens dropdown menu
  handleOpen = e => {
    let {onOpen, isOpen} = this.props;
    let isControlled = typeof isOpen !== 'undefined';
    if (!isControlled) {
      this.setState({
        isOpen: true,
      });
    }

    if (typeof onOpen === 'function') {
      onOpen(e);
    }
  };

  // Decide whether dropdown should be closed when mouse leaves element
  handleMouseLeave = e => {
    let toElement = e.toElement || e.relatedTarget;

    try {
      if (this.dropdownMenu && !this.dropdownMenu.contains(toElement)) {
        this.handleClose(e);
      }
    } catch (err) {
      Raven.captureException(err, {
        event: e,
        toElement: e.toElement,
        relatedTarget: e.relatedTarget,
      });
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
    if (ref && !(ref instanceof HTMLElement)) return;
    this.dropdownMenu = ref;

    if (this.dropdownMenu) {
      // 3rd arg = useCapture = so event capturing vs event bubbling
      document.addEventListener('click', this.checkClickOutside, true);
    } else {
      document.removeEventListener('click', this.checkClickOutside, true);
    }
  };

  handleActorMount = ref => {
    if (ref && !(ref instanceof HTMLElement)) return;
    this.dropdownActor = ref;
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

  getRootProps = props => props;

  // Actor is the component that will open the dropdown menu
  getActorProps = ({onClick, onMouseEnter, onMouseLeave, isStyled, ...props} = {}) => {
    let {isNestedDropdown} = this.props;

    // Props that the actor needs to have <DropdownMenu> work
    //
    // `isStyled`: with styled-components we need to pass `innerRef` to get DOM el's ref vs `ref` otherwise
    return {
      ...props,
      ...((isStyled && {innerRef: this.handleActorMount}) || {}),
      ref: !isStyled ? this.handleActorMount : undefined,
      onMouseEnter: (...args) => {
        if (typeof onMouseEnter === 'function') {
          onMouseEnter(...args);
        }

        if (!isNestedDropdown) return;
        this.handleOpen(...args);
      },

      onMouseLeave: (...args) => {
        if (typeof onMouseLeave === 'function') {
          onMouseLeave(...args);
        }

        if (!isNestedDropdown) return;
        this.handleMouseLeave(...args);
      },
      onClick: (...args) => {
        // Note: clicking on an actor that has a nested menu will close the dropdown menus
        // This is because we currently do not try to find the deepest non-nested dropdown menu
        this.handleToggle(...args);

        if (typeof onClick === 'function') {
          onClick(...args);
        }
      },
    };
  };

  // Menu is the menu component that <DropdownMenu> will control
  getMenuProps = ({onClick, onMouseLeave, isStyled, ...props} = {}) => {
    let {isNestedDropdown} = this.props;

    // Props that the menu needs to have <DropdownMenu> work
    //
    // `isStyled`: with styled-components we need to pass `innerRef` to get DOM el's ref vs `ref` otherwise
    return {
      ...props,
      ...((isStyled && {innerRef: this.handleMenuMount}) || {}),
      ref: !isStyled ? this.handleMenuMount : undefined,
      onMouseLeave: (...args) => {
        if (typeof onMouseLeave === 'function') {
          onMouseLeave(...args);
        }

        if (!isNestedDropdown) return;
        this.handleMouseLeave(...args);
      },
      onClick: e => {
        // Note: clicking on an actor that has a nested menu will close the dropdown menus
        // This is because we currently do not try to find the deepest non-nested dropdown menu
        this.handleDropdownMenuClick(e);

        if (typeof onClick === 'function') {
          onClick(e);
        }
      },
    };
  };

  render() {
    let {children} = this.props;

    // Default anchor = left
    let shouldShowDropdown = this.isOpen();

    return children({
      isOpen: shouldShowDropdown,
      getRootProps: this.getRootProps,
      getActorProps: this.getActorProps,
      getMenuProps: this.getMenuProps,
    });
  }
}

export default DropdownMenu;
