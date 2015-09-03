import React from "react";
import PropTypes from "../../proptypes";
import Router from "react-router";
import EventDataSection from "./eventDataSection";
import {isUrl} from "../../utils";

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

    var {group, event} = this.props;

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
          {isUrl(value) &&
            <a href={value} className="external">
              <em className="icon-browser" />
            </a>
          }
        </li>
      );
    }

    if (children.length === 0) {
      return null;
    }

    return (
      <EventDataSection
          group={group}
          event={event}
          title="Tags"
          type="tags">
        <ul className="mini-tag-list">
          {children}
        </ul>
      </EventDataSection>
    );
  }
});

export default EventTags;
