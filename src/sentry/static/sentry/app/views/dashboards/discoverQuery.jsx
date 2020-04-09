import PropTypes from 'prop-types';
import React from 'react';
import isEqual from 'lodash/isEqual';
import memoize from 'lodash/memoize';
import omit from 'lodash/omit';

import {DEFAULT_STATS_PERIOD} from 'app/constants';
import {getInterval} from 'app/components/charts/utils';
import {getPeriod} from 'app/utils/getPeriod';
import {parsePeriodToHours} from 'app/utils/dates';
import SentryTypes from 'app/sentryTypes';
import createQueryBuilder from 'app/views/discover/queryBuilder';
import withProjects from 'app/utils/withProjects';

// Note: Limit max releases so that chart is still a bit readable
const MAX_RECENT_RELEASES = 20;
const createReleaseFieldCondition = releases => [
  [
    'if',
    [
      [
        'in',
        ['release', 'tuple', releases.slice(0, MAX_RECENT_RELEASES).map(r => `'${r}'`)],
      ],
      'release',
      "'other'",
    ],
    'release',
  ],
];

class DiscoverQuery extends React.Component {
  static propTypes = {
    // means a parent component is still loading releases
    // and we should not perform any API requests yet (if we depend on releases)
    releasesLoading: PropTypes.bool,
    compareToPeriod: PropTypes.shape({
      statsPeriodStart: PropTypes.string,
      statsPeriodEnd: PropTypes.string,
    }),
    includePreviousPeriod: PropTypes.bool,
    organization: SentryTypes.Organization,
    selection: SentryTypes.GlobalSelection,
    queries: PropTypes.arrayOf(SentryTypes.DiscoverQuery),
    releases: PropTypes.arrayOf(SentryTypes.Release),
  };

  state = {
    results: null,
    reloading: null,
  };

  componentDidMount() {
    this.createQueryBuilders();
    this.fetchData();
  }

  shouldComponentUpdate(nextProps, nextState) {
    if (this.state !== nextState) {
      return true;
    }

    // Allow component to update if queries are dependent on releases
    // and if releases change, or releasesLoading prop changes
    if (this.doesRequireReleases(nextProps.queries)) {
      if (!isEqual(this.props.releases, nextProps.releases)) {
        return true;
      }

      if (
        !nextProps.releasesLoading &&
        this.props.releasesLoading !== nextProps.releasesLoading
      ) {
        return true;
      }
    }

    if (
      this.props.organization === nextProps.organization &&
      this.props.selection === nextProps.selection
    ) {
      return false;
    }

    return true;
  }

  componentDidUpdate(prevProps) {
    const keysToIgnore = ['children'];

    // Ignore "releasesLoading" and "releases" props if we are not waiting for releases
    // Otherwise we can potentially make an extra request if releasesLoading !== nextBusy and
    // globalSelection === nextGlobalSelection
    if (!this.doesRequireReleases(this.props.queries)) {
      keysToIgnore.push('releasesLoading');
      keysToIgnore.push('releases');
    }

    if (isEqual(omit(prevProps, keysToIgnore), omit(this.props, keysToIgnore))) {
      return;
    }

    this.createQueryBuilders();
    this.fetchData();
  }

  componentWillUnmount() {
    this.queryBuilders.forEach(builder => builder.cancelRequests());
    // Cleanup query builders
    this.queryBuilders = [];
  }

  // Query builders based on `queries`
  queryBuilders = [];

  // Checks queries for any that are dependent on recent releases
  doesRequireReleases = memoize(
    queries =>
      !!queries.find(
        ({constraints}) => constraints && constraints.includes('recentReleases')
      )
  );

  createQueryBuilders() {
    const {organization, projects, queries} = this.props;

    this.queryBuilders = [];

    queries.forEach(({constraints, ...query}) => {
      if (constraints && constraints.includes('recentReleases')) {
        // Can't create query yet because no releases
        if (!(this.props.releases && this.props.releases.length)) {
          return;
        }
        const newQuery = {
          ...query,
          fields: [],
          conditionFields:
            this.props.releases &&
            this.props.releases.length > 0 &&
            createReleaseFieldCondition(this.props.releases.map(({version}) => version)),
        };
        this.queryBuilders.push(
          createQueryBuilder(this.getQuery(newQuery), organization, projects)
        );
        this.fetchData();
      } else {
        this.queryBuilders.push(
          createQueryBuilder(this.getQuery(query), organization, projects)
        );
      }
    });
  }

  getQuery(query, compareToPeriod) {
    const {includePreviousPeriod} = this.props;
    const {datetime, ...selection} = this.props.selection;
    let period;

    if (!compareToPeriod) {
      const {start, end, statsPeriod} = getPeriod(datetime, {
        shouldDoublePeriod: includePreviousPeriod,
      });
      period = {start, end, range: statsPeriod};
    }

    if (query.rollup) {
      // getInterval returns a period string depending on current datetime range selected
      // we then use a helper function to parse into hours and then convert back to seconds
      query.rollup =
        parsePeriodToHours(
          getInterval({...datetime, period: datetime.period || DEFAULT_STATS_PERIOD})
        ) *
        60 *
        60;
    }

    return {
      ...query,
      ...selection,
      ...period,
      ...compareToPeriod,
    };
  }

  resetQueries() {
    const {queries} = this.props;
    this.queryBuilders.forEach((builder, i) => {
      const query = queries[i];
      builder.reset(this.getQuery(query));
    });
  }

  async fetchData() {
    this.setState({reloading: true});

    // Do not fetch data if dependent on releases and parent component is busy fetching releases
    if (this.doesRequireReleases(this.props.queries) && this.props.releasesLoading) {
      return;
    }

    // Fetch
    const promises = this.queryBuilders.map(builder => builder.fetchWithoutLimit());
    const results = await Promise.all(promises);

    this.setState({
      reloading: false,
      results,
    });
  }

  render() {
    const {children} = this.props;

    return children({
      queries: this.queryBuilders.map(builder => builder.getInternal()),
      reloading: this.state.reloading,
      results: this.state.results,
    });
  }
}

function DiscoverQueryContainer({loadingProjects, children, ...props}) {
  if (loadingProjects) {
    return children({
      queries: [],
      results: null,
      reloading: null,
    });
  }
  return <DiscoverQuery {...props}>{children}</DiscoverQuery>;
}

DiscoverQueryContainer.propTypes = {
  ...DiscoverQuery.propTypes,
  loadingProjects: PropTypes.bool,
  projects: PropTypes.arrayOf(SentryTypes.Project),
};

export default withProjects(DiscoverQueryContainer);
