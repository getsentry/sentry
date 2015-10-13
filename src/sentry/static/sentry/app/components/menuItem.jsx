import React from "react";
import Router from "react-router";
import classNames from "classnames";

var MenuItem = React.createClass({
  propTypes: {
    header:    React.PropTypes.bool,
    divider:   React.PropTypes.bool,
    title:     React.PropTypes.string,
    onSelect:  React.PropTypes.func,
    eventKey:  React.PropTypes.any,
    isActive:  React.PropTypes.bool,
    noAnchor:  React.PropTypes.bool,
    // basic link
    href:      React.PropTypes.string,
    // router link
    to:        React.PropTypes.string,
    params:    React.PropTypes.object,
    query:     React.PropTypes.object,
  },

  contextTypes: {
    router: React.PropTypes.func
  },

  handleClick(e) {
    if (this.props.onSelect) {
      e.preventDefault();
      this.props.onSelect(this.props.eventKey);
    }
  },

  renderAnchor() {
    if (this.props.to) {
      return (
        <Router.Link
            to={this.props.to}
            params={this.props.params}
            query={this.props.query}
            title={this.props.title}
            onClick={this.handleClick}
            className={this.props.linkClassName}
            tabIndex="-1">
          {this.props.children}
        </Router.Link>
      );
    }
    return (
      <a title={this.props.title} onClick={this.handleClick}
          href={this.props.href} className={this.props.linkClassName}
          tabIndex="-1">
        {this.props.children}
      </a>
    );
  },

  render() {
    var classes = {
      "dropdown-header": this.props.header,
      "divider": this.props.divider,
      "active": this.props.isActive
    };

    var children = null;
    if (this.props.noAnchor) {
      children = this.props.children;
    } else if (this.props.header) {
      children = this.props.children;
    } else if (!this.props.divider) {
      children = this.renderAnchor();
    }

    return (
      <li {...this.props} role="presentation" title={null} href={null}
        className={classNames(this.props.className, classes)}>
        {children}
      </li>
    );
  }
});

export default MenuItem;

