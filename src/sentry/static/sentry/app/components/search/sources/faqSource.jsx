import $ from 'jquery';
import {debounce} from 'lodash';
import {withRouter} from 'react-router';
import PropTypes from 'prop-types';
import React from 'react';

import withLatestContext from 'app/utils/withLatestContext';

class FaqSource extends React.Component {
  static propTypes = {
    // search term
    query: PropTypes.string,

    /**
     * Render function that passes:
     * `isLoading` - loading state
     * `allResults` - All results returned from all queries: [searchIndex, model, type]
     * `results` - Results array filtered by `this.props.query`: [searchIndex, model, type]
     */
    children: PropTypes.func.isRequired,
  };

  constructor(props, ...args) {
    super(props, ...args);
    this.state = {
      loading: false,
      results: null,
    };
  }

  componentDidMount() {
    if (typeof this.props.query !== 'undefined') this.doSearch(this.props.query);
  }

  componentWillReceiveProps(nextProps) {
    if (nextProps.query !== this.props.query) {
      this.doSearch(nextProps.query);
    }
  }

  // Debounced method to handle querying all API endpoints (when necessary)
  doSearch = debounce(query => {
    let term = encodeURIComponent(query);
    if (term.length > 2) {
      $.get(
        `https://sentry.zendesk.com/api/v2/help_center/articles/search.json?query=${term}`,
        data => {
          this.setState({
            loading: false,
            results: data.results.map(result => ({
              item: {
                result,
                type: 'faq',
              },
              matches: null,
              score: 1, // Should be smaller than DocsSource
            })),
          });
        }
      );
    } else {
      this.setState({
        loading: false,
        results: [],
      });
    }
  }, 300);

  render() {
    return this.props.children({
      isLoading: this.state.loading,
      allResults: this.state.results,
      results: this.state.results,
    });
  }
}

export {FaqSource};
export default withLatestContext(withRouter(FaqSource));
