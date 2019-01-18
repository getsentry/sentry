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
    };

    // Query builders based on `queries`
    this.queryBuilders = [];

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
    const promises = this.queryBuilders.map(builder => builder.fetchWithoutLimit());
    let results = await Promise.all(promises);
    let previousData = null;
    let data = null;

    this.setState({
      results,
      data,
      previousData,
    });
  }

  render() {
    const {children} = this.props;

    return children({
      queries: this.queryBuilders.map(builder => builder.getInternal()),
      results: this.state.results,
      data: this.state.data,
      previousData: this.state.previousData,
    });
  }
}

export default withGlobalSelection(withOrganization(DiscoverQuery));
