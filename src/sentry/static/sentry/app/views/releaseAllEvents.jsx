import PropTypes from 'prop-types';
import React from 'react';
import {Link} from 'react-router';

import SentryTypes from 'app/proptypes';
import withEnvironmentInQueryString from 'app/utils/withEnvironmentInQueryString';
import GroupList from 'app/components/groupList';
import {t} from 'app/locale';

class ReleaseAllEvents extends React.Component {
  static propTypes = {
    environment: SentryTypes.Environment,
  };

  static contextTypes = {
    release: PropTypes.object,
  };

  render() {
    let {orgId, projectId} = this.props.params;
    return (
      <div>
        <div className="alert alert-block">
          <Link
            to={{
              pathname: `/${orgId}/${projectId}/`,
              query: {query: 'release:' + this.context.release.version},
            }}
          >
            <span className="icon icon-open" />
            {t('View all events seen in this release in the stream')}
          </Link>
        </div>
        <GroupList
          orgId={orgId}
          projectId={projectId}
          query={'release:"' + this.context.release.version + '"'}
          canSelectGroups={false}
          environment={this.props.environment}
        />
      </div>
    );
  }
}

export default withEnvironmentInQueryString(ReleaseAllEvents);
