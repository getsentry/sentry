import React from 'react';
import {Link} from 'react-router';

import SentryTypes from 'app/sentryTypes';
import Alert from 'app/components/alert';
import GroupList from 'app/components/groupList';
import {t} from 'app/locale';

export default class OrganizationReleaseNewEvents extends React.Component {
  static contextTypes = {
    release: SentryTypes.Release,
  };

  render() {
    let {orgId} = this.props.params;
    return (
      <div>
        <Alert icon="icon-open" iconSize="14px" type="warning">
          <Link
            to={{
              pathname: `/organizations/${orgId}/issues/`,
              query: {query: 'first-release:' + this.context.release.version},
            }}
          >
            {t('View new issues seen in this release in the stream')}
          </Link>
        </Alert>
        <GroupList
          orgId={orgId}
          query={'first-release:"' + this.context.release.version + '"'}
          canSelectGroups={false}
        />
      </div>
    );
  }
}
