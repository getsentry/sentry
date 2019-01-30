import {isEqual, omit} from 'lodash';
import PropTypes from 'prop-types';
import React from 'react';

import {getInterval} from 'app/components/charts/utils';
import {getPeriod} from 'app/utils/getPeriod';
import {parsePeriodToHours} from 'app/utils';
import SentryTypes from 'app/sentryTypes';
import createQueryBuilder from 'app/views/organizationDiscover/queryBuilder';

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
  };

  constructor(props) {
    super(props);

    this.state = {
      results: null,
      reloading: null,
    };

    // Query builders based on `queries`
    this.queryBuilders = [];

    this.createQueryBuilders();
  }

  componentDidMount() {
    this.fetchData();
  }

  shouldComponentUpdate(nextProps, nextState) {
    if (this.state !== nextState) {
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

    this.fetchData();
  }

  componentWillUnmount() {
    this.queryBuilders.forEach(builder => builder.cancelRequests());
  }

  createQueryBuilders() {
    const {organization, queries} = this.props;
    queries.forEach(query => {
      this.queryBuilders.push(createQueryBuilder(this.getQuery(query), organization));
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
    // Reset query builder
    this.resetQueries();

    // Fetch
    this.setState({reloading: true});
    const promises = this.queryBuilders.map(builder => builder.fetchWithoutLimit());
    let results = await Promise.all(promises);

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
