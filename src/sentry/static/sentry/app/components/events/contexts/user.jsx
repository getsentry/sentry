/*eslint react/jsx-key:0*/
import PropTypes from 'prop-types';
import React from 'react';
import _ from 'lodash';

import Avatar from 'app/components/avatar';
import ErrorBoundary from 'app/components/errorBoundary';
import KeyValueList from 'app/components/events/interfaces/keyValueList';

class UserContextType extends React.Component {
  static propTypes = {
    data: PropTypes.object.isRequired,
  };

  render() {
    let user = this.props.data;
    let builtins = [];
    let children = [];

    // Handle our native attributes special
    user.id && builtins.push(['ID', <pre>{user.id}</pre>]);
    user.email &&
      builtins.push([
        'Email',
        <pre>
          {user.email}
          <a href={`mailto:${user.email}`} target="_blank" className="external-icon">
            <em className="icon-envelope" />
          </a>
        </pre>,
      ]);
    user.username && builtins.push(['Username', <pre>{user.username}</pre>]);
    user.ip_address && builtins.push(['IP Address', <pre>{user.ip_address}</pre>]);
    user.name && builtins.push(['Name', <pre>{user.name}</pre>]);

    // We also attach user supplied data as 'user.data'
    _.each(user.data, function(value, key) {
      children.push([key, value]);
    });

    return (
      <div className="user-widget">
        <div className="pull-left">
          <Avatar user={user} size={48} gravatar={false} />
        </div>
        <table className="key-value table">
          <tbody>
            {builtins.map(([key, value]) => {
              return (
                <tr key={key}>
                  <td className="key" key="0">
                    {key}
                  </td>
                  <td className="value" key="1">
                    {value}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <ErrorBoundary mini>
          {children && <KeyValueList data={children} isContextData={true} />}
        </ErrorBoundary>
      </div>
    );
  }
}

UserContextType.getTitle = function(value) {
  return 'User';
};

export default UserContextType;
