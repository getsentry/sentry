/*eslint react/jsx-key:0*/
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
    user.id && builtins.push(['ID', <pre>{user.id}</pre>]);
    user.email && builtins.push([
      'Email',
      <pre>
        {user.email}
        <a href={`mailto:${user.email}`} className="external-icon">
          <em className="icon-envelope" />
        </a>
      </pre>
    ]);
    user.username && builtins.push(['Username', <pre>{user.username}</pre>]);
    user.ip_address && builtins.push(['IP Address', <pre>{user.ip_address}</pre>]);

    // We also attach user supplied data as 'user.data'
    _.each(user.data, function(value, key) {
      children.push([key, value]);
    });

    return (
      <div className="user-widget">
        <div className="pull-left">
          <Avatar user={user} size={96} gravatar={false} />
        </div>
        <table className="key-value table">
          {builtins.map(([key, value]) => {
            return (
              <tr key={key}>
                <td className="key" key="0">{key}</td>
                <td className="value" key="1">{value}</td>
              </tr>
            );
          })}
        </table>
        {children &&
          <KeyValueList data={children} isContextData={true} />
        }
      </div>
    );
  }
});

UserContextType.getTitle = function(value) {
  return 'User';
};

export default UserContextType;
