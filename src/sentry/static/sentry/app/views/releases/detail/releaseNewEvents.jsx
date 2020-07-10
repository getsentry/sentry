import React from 'react';
import {Link} from 'react-router';

import SentryTypes from 'app/sentryTypes';
import Alert from 'app/components/alert';
import GroupList from 'app/components/issues//groupList';
import {t} from 'app/locale';
import {IconOpen} from 'app/icons';

const ReleaseNewEvents = props => {
  const {release} = props;
  const {orgId} = props.params;

  return (
    <div>
      <Alert icon={<IconOpen size="14px" />} type="warning">
        <Link
          to={{
            pathname: `/organizations/${orgId}/issues/`,
            query: {query: `firstRelease:${release.version}`},
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
