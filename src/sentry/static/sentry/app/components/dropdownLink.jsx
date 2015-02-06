/*** @jsx React.DOM */
var React = require('react');
var joinClasses = require('react-bootstrap/utils/joinClasses');
var classSet = require('react-bootstrap/utils/classSet');
var cloneWithProps = require('react-bootstrap/utils/cloneWithProps');

var createChainedFunction = require('react-bootstrap/utils/createChainedFunction');
var BootstrapMixin = require('react-bootstrap/BootstrapMixin');
var DropdownStateMixin = require('react-bootstrap/DropdownStateMixin');
var Button = require('react-bootstrap/Button');
var ButtonGroup = require('react-bootstrap/ButtonGroup');
var DropdownMenu = require('react-bootstrap/DropdownMenu');
var ValidComponentChildren = require('react-bootstrap/utils/ValidComponentChildren');


var DropdownButton = React.createClass({
  mixins: [BootstrapMixin, DropdownStateMixin],

  propTypes: {
    pullRight: React.PropTypes.bool,
    dropup:    React.PropTypes.bool,
    title:     React.PropTypes.node,
    href:      React.PropTypes.string,
    onClick:   React.PropTypes.func,
    onSelect:  React.PropTypes.func,
    onOpen:    React.PropTypes.func,
    onClose:   React.PropTypes.func,
    navItem:   React.PropTypes.bool,
    caret:     React.PropTypes.bool,
    disabled:  React.PropTypes.bool,
  },

  childContextTypes: {
    setDropdownState: React.PropTypes.func,
  },

  getChildContext() {
    return {
      setDropdownState: this.setDropdownState,
    };
  },

  getDefaultProps() {
    return {
      caret: true,
      disabled: false
    };
  },

  render() {
    var className = 'dropdown-toggle';
    if (this.props.disabled) {
      className += ' disabled';
    }

    var renderMethod = this.props.navItem ?
      'renderNavItem' : 'renderButtonGroup';

    var caret = this.props.caret ?
      caret = <span aria-hidden="true" className="icon-arrow-down" /> : '';

    return this[renderMethod]([
      <a
        ref="dropdownButton"
        className={joinClasses(this.props.className, className)}
        disabled={this.props.disabled}
        onClick={this.handleDropdownClick}
        key={0}
        navDropdown={this.props.navItem}
        navItem={null}
        title={null}
        pullRight={null}
        dropup={null}>
        {this.props.title}{' '}
        {caret}
      </a>,
      <DropdownMenu
        ref="menu"
        aria-labelledby={this.props.id}
        pullRight={this.props.pullRight}
        key={1}>
        {ValidComponentChildren.map(this.props.children, this.renderMenuItem)}
      </DropdownMenu>
    ]);
  },

  renderButtonGroup(children) {
    var groupClasses = {
        'open': this.state.open,
        'dropup': this.props.dropup
      };

    return (
      <ButtonGroup
        bsSize={this.props.bsSize}
        className={classSet(groupClasses)}>
        {children}
      </ButtonGroup>
    );
  },

  renderNavItem(children) {
    var classes = {
        'dropdown': true,
        'open': this.state.open,
        'dropup': this.props.dropup
      };

    return (
      <li className={classSet(classes)}>
        {children}
      </li>
    );
  },

  componentWillReceiveProps(nextProps) {
    if (nextProps.disabled === true && this.state.open) {
      this.state.open = false;
    }
  },

  componentDidUpdate(prevProps, prevState) {
    if (this.state.open && !prevState.open && this.props.onOpen) {
      this.props.onOpen();
    } else if (!this.state.open && prevState.open && this.props.onClose) {
      this.props.onClose();
    }
  },

  renderMenuItem(child, index) {
    // Only handle the option selection if an onSelect prop has been set on the
    // component or it's child, this allows a user not to pass an onSelect
    // handler and have the browser preform the default action.
    var handleOptionSelect = this.props.onSelect || child.props.onSelect ?
      this.handleOptionSelect : null;

    return cloneWithProps(
      child,
      {
        // Capture onSelect events
        onSelect: createChainedFunction(child.props.onSelect, handleOptionSelect),

        // Force special props to be transferred
        key: child.key ? child.key : index,
        ref: child.ref
      }
    );
  },

  handleDropdownClick(e) {
    e.preventDefault();

    this.setDropdownState(!this.state.open);
  },

  handleOptionSelect(key) {
    if (this.props.onSelect) {
      this.props.onSelect(key);
    }

    this.setDropdownState(false);
  }
});

module.exports = DropdownButton;
