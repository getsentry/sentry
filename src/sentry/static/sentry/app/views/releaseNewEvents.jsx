import PropTypes from 'prop-types';
import React from 'react';
import {Link} from 'react-router';

import SentryTypes from 'app/proptypes';
import GroupList from 'app/components/groupList';
import {t} from 'app/locale';
import withEnvironmentInQueryString from 'app/utils/withEnvironmentInQueryString';

class ReleaseNewEvents extends React.Component {
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
              query: {query: 'first-release:' + this.context.release.version},
            }}
          >
            <span className="icon icon-open" />
            {t('View new events seen in this release in the stream')}
          </Link>
        </div>
        <GroupList
          orgId={orgId}
          projectId={projectId}
          query={'first-release:"' + this.context.release.version + '"'}
          canSelectGroups={false}
          environment={this.props.environment}
        />
      </div>
    );
  }
}

export default withEnvironmentInQueryString(ReleaseNewEvents);
