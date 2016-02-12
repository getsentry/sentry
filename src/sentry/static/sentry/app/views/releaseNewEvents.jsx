import React from 'react';
import {Link} from 'react-router';
import GroupList from '../components/groupList';
import {t} from '../locale';

const ReleaseNewEvents = React.createClass({
  contextTypes: {
    release: React.PropTypes.object
  },

  render() {
    let {orgId, projectId} = this.props.params;
    return (
      <div>
        <div className="alert alert-block">
          <Link to={`/${orgId}/${projectId}/`} query={{
            query: 'first-release:' + this.context.release.version
          }}>
            <span className="icon icon-open"></span>
            {t('View new events seen in this release in the stream')}
          </Link>
        </div>
        <GroupList
          orgId={orgId}
          projectId={projectId}
          query={'first-release:"' + this.context.release.version + '"'}
          canSelectGroups={false} bulkActions={false} />
      </div>
    );
  }
});

export default ReleaseNewEvents;
