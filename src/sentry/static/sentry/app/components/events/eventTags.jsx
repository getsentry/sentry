import React from "react";
import Router from "react-router";
import _ from "underscore";

import PropTypes from "../../proptypes";

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
    var params = this.context.router.getCurrentParams();

    let tags = this.props.event.tags;
    if (_.isEmpty(tags))
      return null;

    let sortedTags = _.chain(tags)
      .map((val, key) => [key, val])
      .sortBy(([key,]) => key)
      .value();

    return (
      <EventDataSection
          group={this.props.group}
          event={this.props.event}
          title="Tags"
          type="tags">
        <ul className="mini-tag-list">
          {sortedTags.map(([key, value]) => {
            return (
              <li key={key}>
                {key} = <Router.Link
                  to="stream"
                  params={params}
                  query={{query: `${key}:"${value}"`}}>
                  {value}
                </Router.Link>
                {isUrl(value) &&
                  <a href={value} className="external-icon">
                    <em className="icon-open" />
                  </a>
                }
              </li>
            );
          })}
        </ul>
      </EventDataSection>
    );
  }
});

export default EventTags;
