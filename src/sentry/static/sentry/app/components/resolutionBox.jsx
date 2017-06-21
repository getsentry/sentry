import React from 'react';
import PureRenderMixin from 'react-addons-pure-render-mixin';

import Version from './version';
import {t, tct} from '../locale';

export default React.createClass({
  propTypes: {
    statusDetails: React.PropTypes.object.isRequired
  },

  mixins: [PureRenderMixin],

  renderReason() {
    let {params, statusDetails} = this.props;
    if (statusDetails.inNextRelease) {
      return t('This issue has been marked as resolved in the upcoming release.');
    } else if (statusDetails.inRelease) {
      return tct('This issue has been marked as resolved as of version [version].', {
        version: (
          <Version
            version={statusDetails.inRelease}
            orgId={params.orgId}
            projectId={params.projectId}
          />
        )
      });
    }
    return t('This issue has been marked as resolved.');
  },

  render() {
    return (
      <div className="box">
        <span className="icon icon-checkmark" />
        <p>{this.renderReason()}</p>
      </div>
    );
  }
});
