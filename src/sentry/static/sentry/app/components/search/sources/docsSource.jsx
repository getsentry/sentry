import {debounce} from 'lodash';
import {withRouter} from 'react-router';
import PropTypes from 'prop-types';
import React from 'react';

import withLatestContext from 'app/utils/withLatestContext';

class DocsSource extends React.Component {
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
      docResults: null,
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
        `https://rigidsearch.getsentry.net/api/search?q=${term}&page=1&section=hosted`,
        data => {
          this.setState({
            loading: false,
            docResults: data.items.map(result => ({
              item: {
                result,
                type: 'docs',
              },
              matches: null,
              score: 10, // Should be larger than FaqSource
            })),
          });
        }
      );
    } else {
      this.setState({
        loading: false,
        docResults: [],
      });
    }
  }, 300);

  render() {
    return this.props.children({
      isLoading: this.state.loading,
      allResults: this.state.docResults,
      results: this.state.docResults,
    });
  }
}

export {DocsSource};
export default withLatestContext(withRouter(DocsSource));
