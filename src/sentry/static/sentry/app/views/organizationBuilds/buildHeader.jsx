import PropTypes from 'prop-types';
import React from 'react';

import TimeSince from 'app/components/timeSince';
import {t} from 'app/locale';
import SentryTypes from 'app/sentryTypes';

import BuildIcon from './buildIcon';

export default class BuildHeader extends React.Component {
  static propTypes = {
    orgId: PropTypes.string.isRequired,
    build: SentryTypes.Build.isRequired,
    onUpdate: PropTypes.func,
  };

  render() {
    const {build} = this.props;

    return (
      <div className="release-details">
        <div className="row">
          <div className="col-sm-10 col-xs-10">
            <h3>{t('Build Details')}</h3>
            <div className="release-meta">{build.name}</div>
          </div>
          <div className="col-sm-2">
            <h6 className="nav-header">{t('Status')}</h6>
            <BuildIcon status={build.status} size={16} />
          </div>
        </div>
      </div>
    );
  }
}
