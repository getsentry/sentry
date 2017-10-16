import jQuery from 'jquery';
import PropTypes from 'prop-types';
import React from 'react';
import classNames from 'classnames';

require('bootstrap/js/dropdown');

const DropdownLink = React.createClass({
  propTypes: {
    title: PropTypes.node,
    /** display dropdown caret */
    caret: PropTypes.bool,
    disabled: PropTypes.bool,
    onOpen: PropTypes.func,
    onClose: PropTypes.func,
    /** anchors menu to the right */
    anchorRight: PropTypes.bool,
    topLevelClasses: PropTypes.string,
    menuClasses: PropTypes.string
  },

  getDefaultProps() {
    return {
      disabled: false,
      anchorRight: false,
      caret: true
    };
  },
  getInitialState() {
    return {
      isOpen: false
    };
  },

  componentDidMount() {
    jQuery(this.refs.dropdownToggle).dropdown();
    jQuery(this.refs.dropdownToggle.parentNode)
      .on('shown.bs.dropdown', e => {
        this.setState({
          isOpen: true
        });
        this.props.onOpen && this.props.onOpen(e);
      })
      .on('hidden.bs.dropdown', e => {
        setTimeout(() => {
          if (!this.isMounted()) {
            return;
          }
          this.setState({
            isOpen: false
          });
          this.props.onClose && this.props.onClose(e);
        });
      });
  },

  componentWillUnmount() {
    jQuery(this.refs.dropdownToggle.parentNode).off();
  },

  close() {
    this.setState({isOpen: false});
  },

  render() {
    let {anchorRight, disabled} = this.props;

    // Default anchor = left
    let isRight = anchorRight;

    let className = classNames(this.props.className, {
      'dropdown-menu-right': isRight,
      'dropdown-toggle': true,
      disabled
    });

    let topLevelClasses = classNames(this.props.topLevelClasses, {
      'pull-right': isRight,
      'anchor-right': isRight,
      dropdown: true,
      open: this.state.isOpen
    });

    return (
      <span className={topLevelClasses}>
        <a className={className} data-toggle="dropdown" ref="dropdownToggle">
          {this.props.title}
          {this.props.caret && <i className="icon-arrow-down" />}
        </a>
        <ul className={classNames(this.props.menuClasses, 'dropdown-menu')}>
          {this.props.children}
        </ul>
      </span>
    );
  }
});

export default DropdownLink;
