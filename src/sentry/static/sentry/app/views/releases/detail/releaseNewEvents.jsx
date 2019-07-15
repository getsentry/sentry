import React from 'react';
import {Link} from 'react-router';

import SentryTypes from 'app/sentryTypes';
import Alert from 'app/components/alert';
import {t} from 'app/locale';

import GroupList from './groupList';

const ReleaseNewEvents = props => {
  const {release} = props;
  const {orgId} = props.params;

  return (
    <div>
      <Alert icon="icon-open" iconSize="14px" type="warning">
        <Link
          to={{
            pathname: `/organizations/${orgId}/issues/`,
            query: {query: 'first-release:' + release.version},
          }}
        >
          {t('View new issues seen in this release in the stream')}
        </Link>
      </Alert>
      <GroupList
        orgId={orgId}
        query={'first-release:"' + release.version + '"'}
        canSelectGroups={false}
      />
    </div>
  );
};
ReleaseNewEvents.propTypes = {
  release: SentryTypes.Release,
};

export default ReleaseNewEvents;
