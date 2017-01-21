import jQuery from 'jquery';
import React from 'react';
import classNames from 'classnames';

require('bootstrap/js/dropdown');

const DropdownLink = React.createClass({
  propTypes: {
    title: React.PropTypes.node,
    caret: React.PropTypes.bool,
    disabled: React.PropTypes.bool,
    onOpen: React.PropTypes.func,
    onClose: React.PropTypes.func,
    topLevelClasses: React.PropTypes.string,
    menuClasses: React.PropTypes.string
  },

  getDefaultProps() {
    return {
      disabled: false,
      caret: true,
    };
  },
  getInitialState() {
    return {
      isOpen: false,
    };
  },

  componentDidMount() {
    jQuery(this.refs.dropdownToggle).dropdown();
    jQuery(this.refs.dropdownToggle.parentNode).on(
      'shown.bs.dropdown', (e) => {
        this.setState({
          isOpen: true,
        });
        this.props.onOpen && this.props.onOpen(e);
      }).on(
      'hidden.bs.dropdown', (e) => {
        setTimeout(() => {
          if (!this.isMounted()) {
            return;
          }
          this.setState({
            isOpen: false,
          });
          this.props.onClose && this.props.onClose(e);
        });
      });
  },

  componentWillUnmount(){
    jQuery(this.refs.dropdownToggle.parentNode).off();
  },

  close() {
    this.setState({isOpen: false});
  },

  render() {
    let className = classNames({
      'dropdown-toggle': true,
      'disabled': this.props.disabled,
    });

    let topLevelClasses = classNames({
      'dropdown' : true,
      'open': this.state.isOpen,
    });

    return (
      <span className={classNames(this.props.topLevelClasses, topLevelClasses)}>
        <a className={classNames(this.props.className, className)}
           data-toggle="dropdown"
           ref="dropdownToggle">
          {this.props.title}
          {this.props.caret &&
            <i className="icon-arrow-down" />
          }
        </a>
        <ul className={classNames(this.props.menuClasses, 'dropdown-menu')}>
          {this.props.children}
        </ul>
      </span>
    );
  }
});

export default DropdownLink;
