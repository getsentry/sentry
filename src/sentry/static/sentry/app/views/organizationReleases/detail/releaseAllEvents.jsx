import React from 'react';
import {Link} from 'react-router';

import SentryTypes from 'app/sentryTypes';
import Alert from 'app/components/alert';
import {t} from 'app/locale';

import GroupList from './groupList';

export default class ReleaseAllEvents extends React.Component {
  static propTypes = {
    release: SentryTypes.Release,
  };

  render() {
    const {orgId} = this.props.params;
    return (
      <div>
        <Alert icon="icon-open" iconSize="14px" type="warning">
          <Link
            to={{
              pathname: `/organizations/${orgId}/issues/`,
              query: {query: 'release:' + this.props.release.version},
            }}
          >
            {t('View all issues seen in this release in the stream')}
          </Link>
        </Alert>
        <GroupList
          orgId={orgId}
          query={'release:"' + this.props.release.version + '"'}
          canSelectGroups={false}
        />
      </div>
    );
  }
}
