import PropTypes from 'prop-types';
import React from 'react';

import {getPeriod} from 'app/utils/getPeriod';
import SentryTypes from 'app/sentryTypes';
import createQueryBuilder from 'app/views/organizationDiscover/queryBuilder';
import withGlobalSelection from 'app/utils/withGlobalSelection';
import withOrganization from 'app/utils/withOrganization';

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
      systemResults: null,
    };

    // Query builders based on `queries`
    this.queryBuilders = [];

    // Query builders for system generated queries
    // e.g. when comparing to equivalent query but with different timeframe
    this.systemQueryBuilders = [];

    this.createQueryBuilders();
  }

  componentDidMount() {
    this.fetchData();
  }

  componentDidUpdate(prevProps) {
    if (prevProps === this.props) {
      return;
    }

    this.fetchData();
  }

  createQueryBuilders() {
    const {compareToPeriod, organization, queries} = this.props;
    queries.forEach(query => {
      this.queryBuilders.push(createQueryBuilder(this.getQuery(query), organization));

      // Make sure this.queryBuilders.length === this.systemQueryBuilders.length
      this.systemQueryBuilders.push(
        compareToPeriod
          ? createQueryBuilder(this.getQuery(query, compareToPeriod), organization)
          : null
      );
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

    return {
      ...query,
      ...selection,
      ...period,
      ...compareToPeriod,
    };
  }

  resetQueries() {
    const {compareToPeriod, queries} = this.props;
    this.queryBuilders.forEach((builder, i) => {
      const query = queries[i];
      builder.reset(this.getQuery(query));

      if (this.systemQueryBuilders[i]) {
        this.systemQueryBuilders[i].reset(this.getQuery(query, compareToPeriod));
      }
    });
  }

  async fetchData() {
    // Reset query builder
    this.resetQueries();

    // Fetch
    const promises = this.queryBuilders.map(builder => builder.fetch());
    const systemPromises = this.systemQueryBuilders.map(
      builder => (builder ? builder.fetch() : null)
    );
    let results = await Promise.all(promises);
    let systemResults = await Promise.all(systemPromises);
    let previousData = null;
    let data = null;

    this.setState({
      results,
      systemResults,
      data,
      previousData,
    });
  }

  render() {
    const {children} = this.props;

    return children({
      queries: this.queryBuilders.map(builder => builder.getInternal()),
      results: this.state.results,
      systemResults: this.state.systemResults,
      data: this.state.data,
      previousData: this.state.previousData,
    });
  }
}

export default withGlobalSelection(withOrganization(DiscoverQuery));
