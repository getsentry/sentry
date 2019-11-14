/*eslint react/jsx-key:0*/
import PropTypes from 'prop-types';
import React from 'react';
import each from 'lodash/each';

import Avatar from 'app/components/avatar';
import ErrorBoundary from 'app/components/errorBoundary';
import ExternalLink from 'app/components/links/externalLink';
import KeyValueList from 'app/components/events/interfaces/keyValueList';
import {removeFilterMaskedEntries} from 'app/components/events/interfaces/utils';

const EMAIL_REGEX = /[^@]+@[^\.]+\..+/;

class UserContextType extends React.Component {
  static propTypes = {
    data: PropTypes.object.isRequired,
  };

  render() {
    const user = this.props.data;
    const builtins = [];
    const children = [];

    // Handle our native attributes specially
    user.id && builtins.push(['ID', <pre>{user.id}</pre>]);
    user.email &&
      builtins.push([
        'Email',
        <pre>
          {user.email}
          {EMAIL_REGEX.test(user.email) && (
            <ExternalLink href={`mailto:${user.email}`} className="external-icon">
              <em className="icon-envelope" />
            </ExternalLink>
          )}
        </pre>,
      ]);
    user.username && builtins.push(['Username', <pre>{user.username}</pre>]);
    user.ip_address && builtins.push(['IP Address', <pre>{user.ip_address}</pre>]);
    user.name && builtins.push(['Name', <pre>{user.name}</pre>]);

    // We also attach user supplied data as 'user.data'
    each(user.data, function(value, key) {
      children.push([key, value]);
    });

    return (
      <div className="user-widget">
        <div className="pull-left">
          <Avatar user={removeFilterMaskedEntries(user)} size={48} gravatar={false} />
        </div>
        <table className="key-value table">
          <tbody>
            {builtins.map(([key, value]) => {
              return (
                <tr key={key}>
                  <td className="key" key="0">
                    {key}
                  </td>
                  <td
                    className="value"
                    key="1"
                    data-test-id={`user-context-${key.toLowerCase()}-value`}
                  >
                    {value}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <ErrorBoundary mini>
          {children && <KeyValueList data={children} isContextData />}
        </ErrorBoundary>
      </div>
    );
  }
}

UserContextType.getTitle = () => 'User';

export default UserContextType;
