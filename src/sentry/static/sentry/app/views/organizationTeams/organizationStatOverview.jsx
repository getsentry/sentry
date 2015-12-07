import React from 'react';
import {Link} from 'react-router';
import classNames from 'classnames';

import ApiMixin from '../../mixins/apiMixin';
import OrganizationState from '../../mixins/organizationState';

import {defined} from '../../utils';
import {t} from '../../locale';

const OrganizationStatOverview = React.createClass({
  propTypes: {
    orgId: React.PropTypes.string
  },

  contextTypes: {
    location: React.PropTypes.object
  },

  mixins: [
    ApiMixin,
    OrganizationState
  ],

  getInitialState() {
    return {
      totalRejected: null,
      epm: null
    };
  },

  componentWillMount() {
    this.fetchData();
  },

  getOrganizationStatsEndpoint() {
    return '/organizations/' + this.props.orgId + '/stats/';
  },

  fetchData() {
    let statsEndpoint = this.getOrganizationStatsEndpoint();
    this.api.request(statsEndpoint, {
      query: {
        since: new Date().getTime() / 1000 - 3600 * 24,
        stat: 'rejected'
      },
      success: (data) => {
        let totalRejected = 0;
        data.forEach((point) => {
          totalRejected += point[1];
        });
        this.setState({totalRejected: totalRejected});
      }
    });
    this.api.request(statsEndpoint, {
      query: {
        since: new Date().getTime() / 1000 - 3600 * 3,
        resolution: '1h',
        stat: 'received'
      },
      success: (data) => {
        let received = [0, 0];
        data.forEach((point) => {
          if (point[1] > 0) {
            received[0] += point[1];
            received[1] += 1;
          }
        });
        let epm = (received[1] ? parseInt((received[0] / received[1]) / 60, 10) : 0);
        this.setState({epm: epm});
      }
    });
  },

  render() {
    if (!defined(this.state.epm) || !defined(this.state.totalRejected))
      return null;

    let access = this.getAccess();

    let rejectedClasses = ['count'];
    if (this.state.totalRejected > 0)
      rejectedClasses.push('rejected');

    return (
      <div className={this.props.className}>
        <h6 className="nav-header">{t('Events Per Minute')}</h6>
        <p className="count">{this.state.epm}</p>
        <h6 className="nav-header">{t('Rejected in last 24h')}</h6>
        <p className={classNames(rejectedClasses)}>{this.state.totalRejected}</p>
        {access.has('org:read') &&
          <Link to={`/organizations/${this.props.orgId}/stats/`} className="stats-link">
            {t('View all stats')}
          </Link>
        }
      </div>
    );
  }
});

export default OrganizationStatOverview;
