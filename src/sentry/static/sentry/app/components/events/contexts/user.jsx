import React from 'react';
import _ from 'underscore';

import Avatar from '../../../components/avatar';
import KeyValueList from '../interfaces/keyValueList';

const UserContextType = React.createClass({
  propTypes: {
    data: React.PropTypes.object.isRequired,
  },

  render() {
    let user = this.props.data;
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
      <div className="user-widget">
        <div className="pull-left">
          <Avatar user={user} size={96} gravatar={false} />
        </div>
        <KeyValueList data={builtins} isContextData={false} />
        {children &&
          <KeyValueList data={children} isContextData={true} />
        }
      </div>
    );
  }
});

export default UserContextType;
