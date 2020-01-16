import {withRouter} from 'react-router';
import PropTypes from 'prop-types';
import React from 'react';
import moment from 'moment-timezone';
import isEqual from 'lodash/isEqual';

import {addErrorMessage} from 'app/actionCreators/indicator';
import {getUserTimezone} from 'app/utils/dates';
import {t} from 'app/locale';
import MarkLine from 'app/components/charts/components/markLine';
import SentryTypes from 'app/sentryTypes';
import theme from 'app/utils/theme';
import withApi from 'app/utils/withApi';
import withOrganization from 'app/utils/withOrganization';

// This is not an exported action/function because releases list uses AsyncComponent
// and this is not re-used anywhere else afaict
function getOrganizationReleases(api, organization, projects = null) {
  const query = {};
  if (projects) {
    query.project = projects;
  }
  return api.requestPromise(`/organizations/${organization.slug}/releases/`, {
    method: 'GET',
    query,
  });
}

class ReleaseSeries extends React.Component {
  static propTypes = {
    api: PropTypes.object,
    router: PropTypes.object,
    organization: SentryTypes.Organization,
    projects: PropTypes.arrayOf(PropTypes.number),

    utc: PropTypes.bool,
    // Array of releases, if empty, component will fetch releases itself
    releases: PropTypes.arrayOf(SentryTypes.Release),
  };

  state = {
    releases: null,
    releaseSeries: [],
  };

  componentDidMount() {
    if (this.props.releases) {
      // No need to fetch releases if passed in from props
      return;
    }

    this.fetchData();
  }

  componentDidUpdate(prevProps) {
    if (!isEqual(prevProps.projects, this.props.projects)) {
      this.fetchData();
    }
  }

  fetchData() {
    const {api, organization, projects} = this.props;

    getOrganizationReleases(api, organization, projects)
      .then(releases => {
        this.setState({
          releases,
          releaseSeries: [this.getReleaseSeries(releases)],
        });
      })
      .catch(() => {
        addErrorMessage(t('Error fetching releases'));
      });
  }

  getReleaseSeries = releases => {
    const {utc, organization, router} = this.props;

    return {
      seriesName: 'Releases',
      data: [],
      markLine: MarkLine({
        lineStyle: {
          normal: {
            color: theme.purpleLight,
            opacity: 0.3,
            type: 'solid',
          },
        },
        tooltip: {
          formatter: ({data}) => {
            return `<div>${moment
              .tz(data.value, utc ? 'UTC' : getUserTimezone())
              .format('MMM D, YYYY LT')} <br />
            Release: ${data.name}<br />
            </div>`;
          },
        },
        label: {
          show: false,
        },
        data: releases.map(release => ({
          xAxis: +new Date(release.dateCreated),
          name: release.shortVersion,
          value: release.shortVersion,
          onClick: () => {
            router.push(
              `/organizations/${organization.slug}/releases/${release.version}/`
            );
          },
          label: {
            formatter: () => release.shortVersion,
          },
        })),
      }),
    };
  };

  render() {
    const {children} = this.props;

    return children({
      releases: this.state.releases,
      releaseSeries: this.state.releaseSeries,
    });
  }
}

export default withRouter(withOrganization(withApi(ReleaseSeries)));
