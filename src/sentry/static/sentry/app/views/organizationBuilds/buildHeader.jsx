import PropTypes from 'prop-types';
import React, {Component} from 'react';

import {t} from 'app/locale';
import {Client} from 'app/api';
import SentryTypes from 'app/sentryTypes';
import Button from 'app/components/button';

export default class BuildHeader extends Component {
  static propTypes = {
    build: SentryTypes.Build.isRequired,
    onUpdate: PropTypes.func,
  };

  componentWillMount() {
    this.api = new Client();
  }

  componentWillUnmount() {
    this.api.clear();
  }

  changeStatus = newStatus => {
    this.api
      .requestPromise(`/builds/${this.props.build.id}/`, {
        method: 'PUT',
        data: {
          status: newStatus,
        },
      })
      .then(result => {
        this.props.onUpdate(result);
      });
  };

  render() {
    const {build} = this.props;

    return (
      <div className="release-details">
        <div className="row">
          <div className="col-sm-8 col-xs-8">
            <h3>{t('Build Details')}</h3>
            <div className="release-meta">{build.name}</div>
          </div>
          <div className="col-sm-2">
            <h6 className="nav-header">{t('Errors')}</h6>
            <div className="release-meta">{build.totalEvents.toLocaleString()}</div>
          </div>
          <div className="col-sm-2">
            <h6 className="nav-header">{t('Action')}</h6>
            {build.status === 'needs_approved' && (
              <Button
                priority="success"
                size="small"
                onClick={() => this.changeStatus('approved')}
              >
                Approve
              </Button>
            )}
            {build.status === 'approved' && (
              <Button
                priority="danger"
                size="small"
                onClick={() => this.changeStatus('needs_approved')}
              >
                Unapprove
              </Button>
            )}
          </div>
        </div>
      </div>
    );
  }
}
