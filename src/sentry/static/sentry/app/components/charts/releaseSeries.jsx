import {withRouter} from 'react-router';
import PropTypes from 'prop-types';
import {Component} from 'react';
import isEqual from 'lodash/isEqual';

import {addErrorMessage} from 'app/actionCreators/indicator';
import {getFormattedDate, getUtcDateString} from 'app/utils/dates';
import {t} from 'app/locale';
import MarkLine from 'app/components/charts/components/markLine';
import SentryTypes from 'app/sentryTypes';
import theme from 'app/utils/theme';
import withApi from 'app/utils/withApi';
import withOrganization from 'app/utils/withOrganization';
import {escape} from 'app/utils';
import {formatVersion} from 'app/utils/formatters';

// This is not an exported action/function because releases list uses AsyncComponent
// and this is not re-used anywhere else afaict
function getOrganizationReleases(api, organization, conditions = null) {
  const query = {};
  Object.keys(conditions).forEach(key => {
    let value = conditions[key];
    if (value && (key === 'start' || key === 'end')) {
      value = getUtcDateString(value);
    }
    if (value) {
      query[key] = value;
    }
  });
  api.clear();
  return api.requestPromise(`/organizations/${organization.slug}/releases/`, {
    method: 'GET',
    query,
  });
}

class ReleaseSeries extends Component {
  static propTypes = {
    api: PropTypes.object,
    router: PropTypes.object,
    organization: SentryTypes.Organization,
    projects: PropTypes.arrayOf(PropTypes.number),
    environments: PropTypes.arrayOf(PropTypes.string),

    period: PropTypes.string,
    start: PropTypes.oneOfType([PropTypes.instanceOf(Date), PropTypes.string]),
    end: PropTypes.oneOfType([PropTypes.instanceOf(Date), PropTypes.string]),
    utc: PropTypes.bool,
    // Array of releases, if empty, component will fetch releases itself
    releases: PropTypes.arrayOf(SentryTypes.Release),
    tooltip: SentryTypes.EChartsTooltip,
  };

  state = {
    releases: null,
    releaseSeries: [],
  };

  componentDidMount() {
    this._isMounted = true;
    const {releases} = this.props;

    if (releases) {
      // No need to fetch releases if passed in from props
      this.setReleasesWithSeries(releases);
      return;
    }

    this.fetchData();
  }

  componentDidUpdate(prevProps) {
    if (
      !isEqual(prevProps.projects, this.props.projects) ||
      !isEqual(prevProps.environments, this.props.environments) ||
      !isEqual(prevProps.start, this.props.start) ||
      !isEqual(prevProps.end, this.props.end) ||
      !isEqual(prevProps.period, this.props.period)
    ) {
      this.fetchData();
    }
  }

  componentWillUnmount() {
    this._isMounted = false;
    this.props.api.clear();
  }

  fetchData() {
    const {api, organization, projects, environments, period, start, end} = this.props;
    const conditions = {
      start,
      end,
      project: projects,
      environment: environments,
      statsPeriod: period,
    };
    getOrganizationReleases(api, organization, conditions)
      .then(releases => {
        if (this._isMounted) {
          this.setReleasesWithSeries(releases);
        }
      })
      .catch(() => {
        addErrorMessage(t('Error fetching releases'));
      });
  }

  setReleasesWithSeries(releases) {
    this.setState({
      releases,
      releaseSeries: [this.getReleaseSeries(releases)],
    });
  }

  getReleaseSeries = releases => {
    const {organization, router, tooltip} = this.props;

    return {
      seriesName: 'Releases',
      data: [],
      markLine: MarkLine({
        lineStyle: {
          normal: {
            color: theme.purple400,
            opacity: 0.3,
            type: 'solid',
          },
        },
        tooltip: tooltip || {
          trigger: 'item',
          formatter: ({data}) => {
            // XXX using this.props here as this function does not get re-run
            // unless projects are changed. Using a closure variable would result
            // in stale values.
            const time = getFormattedDate(data.value, 'MMM D, YYYY LT', {
              local: !this.props.utc,
            });
            const version = escape(formatVersion(data.name, true));
            return [
              '<div class="tooltip-series">',
              `<div><span class="tooltip-label"><strong>${t(
                'Release'
              )}</strong></span> ${version}</div>`,
              '</div>',
              '<div class="tooltip-date">',
              time,
              '</div>',
              '</div>',
              '<div class="tooltip-arrow"></div>',
            ].join('');
          },
        },
        label: {
          show: false,
        },
        data: releases.map(release => ({
          xAxis: +new Date(release.dateCreated),
          name: formatVersion(release.version, true),
          value: formatVersion(release.version, true),
          onClick: () => {
            router.push({
              pathname: `/organizations/${organization.slug}/releases/${release.version}/`,
              query: new Set(organization.features).has('global-views')
                ? undefined
                : {project: router.location.query.project},
            });
          },
          label: {
            formatter: () => formatVersion(release.version, true),
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
