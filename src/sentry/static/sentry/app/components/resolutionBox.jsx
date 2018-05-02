import PropTypes from 'prop-types';
import React from 'react';

import Avatar from 'app/components/avatar';
import Version from 'app/components/version';
import {t, tct} from 'app/locale';

export default class ResolutionBox extends React.Component {
  static propTypes = {
    statusDetails: PropTypes.object.isRequired,
  };

  renderReason = () => {
    let {params, statusDetails} = this.props;
    let actor = statusDetails.actor ? (
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
            orgId={params.orgId}
            projectId={params.projectId}
          />
        ),
      });
    } else if (statusDetails.inRelease) {
      return tct('This issue has been marked as resolved in version [version].', {
        version: (
          <Version
            version={statusDetails.inRelease}
            orgId={params.orgId}
            projectId={params.projectId}
          />
        ),
      });
    }
    return t('This issue has been marked as resolved.');
  };

  render = () => {
    return (
      <div className="box">
        <span className="icon icon-checkmark" />
        <p>{this.renderReason()}</p>
      </div>
    );
  };
}
