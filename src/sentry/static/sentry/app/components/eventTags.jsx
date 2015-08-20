import React from "react";
import PropTypes from "../proptypes";
import Router from "react-router";

var EventTags = React.createClass({
  contextTypes: {
    router: React.PropTypes.func
  },

  propTypes: {
    group: PropTypes.Group.isRequired,
    event: PropTypes.Event.isRequired
  },

  render() {
    var params = this.context.router.getCurrentParams(),
      children = [],
      value;

    for (var key in this.props.event.tags) {
      value = this.props.event.tags[key];

      children.push(
        <li key={key}>
          {key} = <Router.Link
            to="stream"
            params={params}
            query={{query: key + ':' + '"' + value + '"'}}>
            {value}
          </Router.Link>
        </li>
      );
    }

    if (children.length === 0) {
      return null;
    }

    return (
      <div id="tags" className="box">
        <div className="box-header">
          <h3>Tags</h3>
        </div>
        <div className="box-content with-padding">
          <ul className="mini-tag-list">
            {children}
          </ul>
        </div>
      </div>
    );
  }
});

export default EventTags;


