import {isEqual, omit} from 'lodash';
import PropTypes from 'prop-types';
import React from 'react';

import {getInterval} from 'app/components/charts/utils';
import {getPeriod} from 'app/utils/getPeriod';
import {parsePeriodToHours} from 'app/utils';
import SentryTypes from 'app/sentryTypes';
import createQueryBuilder from 'app/views/organizationDiscover/queryBuilder';

const createReleaseFieldCondition = releases => [
  [
    'if',
    [['in', ['release', 'tuple', releases.map(r => `'${r}'`)]], 'release', "'other'"],
    'release',
  ],
];

class DiscoverQuery extends React.Component {
  static propTypes = {
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

  constructor(props) {
    super(props);

    this.state = {
      results: null,
      reloading: null,
    };

    // Query builders based on `queries`
    this.queryBuilders = [];
  }

  componentDidMount() {
    this.createQueryBuilders();
    this.fetchData();
  }

  shouldComponentUpdate(nextProps, nextState) {
    if (this.state !== nextState) {
      return true;
    }

    if (this.props.releases !== nextProps.releases) {
      return true;
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
    if (isEqual(omit(prevProps, keysToIgnore), omit(this.props, keysToIgnore))) {
      return;
    }

    if (this.props.releases !== prevProps.releases) {
      this.createQueryBuilders();
    } else {
      this.fetchData();
    }
  }

  componentWillUnmount() {
    this.queryBuilders.forEach(builder => builder.cancelRequests());
  }

  createQueryBuilders() {
    const {organization, queries} = this.props;
    queries.forEach(({constraints, ...query}) => {
      if (constraints && constraints.includes('recentReleases')) {
        if (!this.props.releases) {
          return;
        }
        const newQuery = {
          ...query,
          fields: [],
          condition_fields:
            this.props.releases &&
            createReleaseFieldCondition(this.props.releases.map(({version}) => version)),
        };
        this.queryBuilders.push(
          createQueryBuilder(this.getQuery(newQuery), organization)
        );
        this.fetchData();
      } else {
        this.queryBuilders.push(createQueryBuilder(this.getQuery(query), organization));
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
      query.rollup = parsePeriodToHours(getInterval(datetime)) * 60 * 60;
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
    // Fetch
    this.setState({reloading: true});
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

export default DiscoverQuery;
