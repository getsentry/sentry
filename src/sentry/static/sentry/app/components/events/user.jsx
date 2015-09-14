import _ from "underscore";
import React from "react";
import Gravatar from "../../components/gravatar";
import DefinitionList from "./interfaces/definitionList";
import EventDataSection from "./eventDataSection";

function keyToName(key) {
  // Take a given key, and transform it from
  // camel case to title case
  if (!key) return '';
  key = key[0].toUpperCase() + key.slice(1);
  return key.replace(/_/g, ' ');
}

var EventUser = React.createClass({
  render() {
    var user = this.props.event.user;
    var children = [];

    // Handle our native attributes special
    user.id && children.push(['ID', user.id]);
    user.email && children.push(['Email', user.email]);
    user.username && children.push(['Username', user.username]);
    user.ipAddress && children.push(['IP', user.ipAddress]);

    // We also attach user supplied data as 'user.data'
    _.each(user.data, function(value, key) {
      children.push([keyToName(key), value]);
    });

    return (
      <EventDataSection
          group={this.props.group}
          event={this.props.event}
          type="user"
          title="User">
        <div className="user-widget">
          <div className="pull-left"><Gravatar email={user.email} size={84} /></div>
          <DefinitionList data={children} />
        </div>
      </EventDataSection>
    );
  }
});

export default EventUser;
