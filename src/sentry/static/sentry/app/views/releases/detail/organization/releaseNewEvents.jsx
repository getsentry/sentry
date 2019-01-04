import React from 'react';
import {Link} from 'react-router';

import SentryTypes from 'app/sentryTypes';
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
        <div className="alert alert-block">
          <Link
            to={{
              pathname: `/organizations/${orgId}/issues/`,
              query: {query: 'first-release:' + this.context.release.version},
            }}
          >
            <span className="icon icon-open" />
            {t('View new events seen in this release in the stream')}
          </Link>
        </div>
        <GroupList
          orgId={orgId}
          query={'first-release:"' + this.context.release.version + '"'}
          canSelectGroups={false}
        />
      </div>
    );
  }
}
