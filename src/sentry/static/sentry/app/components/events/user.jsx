import _ from 'underscore';
import React from 'react';
import Gravatar from '../../components/gravatar';
import KeyValueList from './interfaces/keyValueList';
import EventDataSection from './eventDataSection';


const EventUser = React.createClass({
  render() {
    let user = this.props.event.user;
    let builtins = [];
    let children = [];

    // Handle our native attributes special
    user.id && builtins.push(['ID', user.id]);
    user.email && builtins.push(['Email', user.email]);
    user.username && builtins.push(['Username', user.username]);
    user.ip_address && builtins.push(['IP Address', user.ip_address]);

    // We also attach user supplied data as 'user.data'
    _.each(user.data, function(value, key) {
      children.push([key, value]);
    });

    return (
      <EventDataSection
          group={this.props.group}
          event={this.props.event}
          type="user"
          title="User">
        <div className="user-widget">
          <div className="pull-left"><Gravatar email={user.email} size={96} /></div>
          <KeyValueList data={builtins} isContextData={false} />
          {children &&
            <KeyValueList data={children} isContextData={true} />
          }
        </div>
      </EventDataSection>
    );
  }
});

export default EventUser;
