import React from 'react';

import {Link} from 'react-router';

import ApiMixin from '../../mixins/apiMixin';
import StackedBarChart from '../../components/stackedBarChart';
import LoadingError from '../../components/loadingError';
import OrganizationState from '../../mixins/organizationState';

import {t} from '../../locale';

const EventsPerHour = React.createClass({
  mixins: [ApiMixin, OrganizationState],

  getInitialState() {
    let until = Math.floor(new Date().getTime() / 1000);
    let since = until - 3600 * 24;

    return {
      rawOrgData: {},
      formattedData: null,
      querySince: since,
      queryUntil: until,
      error: false
    };
  },

  componentDidMount() {
    this.fetchData();
  },

  // Use this so there's a standard order for y values and bar classes
  STAT_OPTS: ['received', 'rejected', 'blacklisted'],

  fetchData() {
    let statEndpoint = this.getEndpoint();

    let query = {
      since: this.state.querySince,
      until: this.state.queryUntil,
      resolution: '1h'
    };

    $.when
      .apply(
        $,
        this.STAT_OPTS.map(stat => {
          let deferred = $.Deferred();
          this.api.request(statEndpoint, {
            query: Object.assign({stat: stat}, query),
            success: deferred.resolve.bind(deferred),
            error: deferred.reject.bind(deferred)
          });
          return deferred;
        })
      )
      .done(
        function() {
          let rawOrgData = {};
          for (let i = 0; i < this.STAT_OPTS.length; i++) {
            rawOrgData[this.STAT_OPTS[i]] = arguments[i][0];
          }
          this.setState({
            rawOrgData: rawOrgData,
            formattedData: this.formatData(rawOrgData)
          });
        }.bind(this)
      )
      .fail(
        function() {
          this.setState({error: true});
        }.bind(this)
      );
  },

  getEndpoint() {
    return `/organizations/${this.props.params.orgId}/stats/`;
  },

  formatData(rawData) {
    return this.STAT_OPTS.map(stat => {
      return {
        data: rawData[stat].map(([x, y]) => {
          return {x, y};
        }),
        label: stat
      };
    });
  },

  render() {
    if (this.state.error) {
      return <LoadingError />;
    }

    if (!this.state.formattedData) {
      return null;
    }
    let org = this.getOrganization();

    return (
      <div>
        <Link className="btn-sidebar-header" to={`/organizations/${org.slug}/stats/`}>
          {t('View Stats')}
        </Link>
        <h6 className="nav-header">{t('Events Per Hour')}</h6>
        <StackedBarChart
          series={this.state.formattedData}
          className="dashboard-barchart standard-barchart"
          label="events"
          barClasses={this.STAT_OPTS}
        />
      </div>
    );
  }
});

export default EventsPerHour;
