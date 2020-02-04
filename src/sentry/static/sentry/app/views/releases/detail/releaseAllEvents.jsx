import React from 'react';
import {Link} from 'react-router';

import SentryTypes from 'app/sentryTypes';
import Alert from 'app/components/alert';
import {t} from 'app/locale';
import {IconOpen} from 'app/icons';

import GroupList from './groupList';

const ReleaseAllEvents = ({release, params}) => {
  const {orgId} = params;
  return (
    <div>
      <Alert type="warning" icon={<IconOpen />}>
        <Link
          to={{
            pathname: `/organizations/${orgId}/issues/`,
            query: {query: 'release:' + release.version},
          }}
        >
          {t('View all issues seen in this release in the stream')}
        </Link>
      </Alert>
      <GroupList
        orgId={orgId}
        query={'release:"' + release.version + '"'}
        canSelectGroups={false}
      />
    </div>
  );
};
ReleaseAllEvents.propTypes = {
  release: SentryTypes.Release,
};

export default ReleaseAllEvents;
