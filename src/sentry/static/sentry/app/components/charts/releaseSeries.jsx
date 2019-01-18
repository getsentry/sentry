import PropTypes from 'prop-types';
import React from 'react';

import {addErrorMessage} from 'app/actionCreators/indicator';
import {getFormattedDate} from 'app/utils/dates';
import {t} from 'app/locale';
import MarkLine from 'app/components/charts/components/markLine';
import SentryTypes from 'app/sentryTypes';
import theme from 'app/utils/theme';
import withApi from 'app/utils/withApi';
import withOrganization from 'app/utils/withOrganization';

function getOrganizationReleases(api, organization) {
  return api.requestPromise(`/organizations/${organization.slug}/releases/`);
}

function getReleaseSeries(releases) {
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
          return `<div>${getFormattedDate(data.value, 'MMM D, YYYY LT')} <br />
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
        label: {
          formatter: () => release.shortVersion,
        },
      })),
    }),
  };
}

class ReleaseSeries extends React.Component {
  static propTypes = {
    api: PropTypes.object,
    organization: SentryTypes.Organization,

    // Array of releases, if empty, component will fetch releases itself
    releases: PropTypes.arrayOf(SentryTypes.Release),
  };

  state = {
    releases: null,
    releaseSeries: [],
  };

  componentDidMount() {
    if (this.props.releases) {
      return;
    }

    const {api, organization} = this.props;

    getOrganizationReleases(api, organization)
      .then(releases => {
        this.setState({
          releases,
          releaseSeries: [getReleaseSeries(releases)],
        });
      })
      .catch(() => {
        addErrorMessage(t('Error fetching releases'));
      });
  }

  render() {
    const {children} = this.props;

    return children({
      releases: this.state.releases,
      releaseSeries: this.state.releaseSeries,
    });
  }
}

export default withOrganization(withApi(ReleaseSeries));
