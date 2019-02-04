import PropTypes from 'prop-types';
import React from 'react';

import Avatar from 'app/components/avatar';
import CommitLink from 'app/components/commitLink';
import Version from 'app/components/version';
import {t, tct} from 'app/locale';

export default class ResolutionBox extends React.Component {
  static propTypes = {
    statusDetails: PropTypes.object.isRequired,
    orgId: PropTypes.string.isRequired,
    projectId: PropTypes.string.isRequired,
  };

  renderReason = () => {
    const {orgId, projectId, statusDetails} = this.props;
    const actor = statusDetails.actor ? (
      <strong>
        <Avatar user={statusDetails.actor} size={20} className="avatar" />
        <span style={{marginLeft: 5}}>{statusDetails.actor.name}</span>
      </strong>
    ) : null;

    if (statusDetails.inNextRelease && statusDetails.actor) {
      return tct('[actor] marked this issue as resolved in the upcoming release.', {
        actor,
      });
    } else if (statusDetails.inNextRelease) {
      return t('This issue has been marked as resolved in the upcoming release.');
    } else if (statusDetails.inRelease && statusDetails.actor) {
      return tct('[actor] marked this issue as resolved in version [version].', {
        actor,
        version: (
          <Version
            version={statusDetails.inRelease}
            orgId={orgId}
            projectId={projectId}
          />
        ),
      });
    } else if (statusDetails.inRelease) {
      return tct('This issue has been marked as resolved in version [version].', {
        version: (
          <Version
            version={statusDetails.inRelease}
            orgId={orgId}
            projectId={projectId}
          />
        ),
      });
    } else if (!!statusDetails.inCommit) {
      return tct('This issue has been marked as resolved by [commit]', {
        commit: (
          <CommitLink
            commitId={statusDetails.inCommit.id}
            repository={statusDetails.inCommit.repository}
          />
        ),
      });
    }
    return t('This issue has been marked as resolved.');
  };

  render = () => {
    return (
      <div
        className="box"
        style={{display: 'flex', alignItems: 'center', flex: 1, paddingBottom: 15}}
      >
        <span className="icon icon-checkmark" style={{position: 'static', top: 0}} />
        <p className="truncate break-all" style={{paddingBottom: 0, paddingLeft: 16}}>
          {this.renderReason()}
        </p>
      </div>
    );
  };
}
