import {withRouter} from 'react-router';
import PropTypes from 'prop-types';
import {Component} from 'react';
import Reflux from 'reflux';
import createReactClass from 'create-react-class';

import {loadSearchMap} from 'app/actionCreators/formSearch';
import {createFuzzySearch} from 'app/utils/createFuzzySearch';
import FormSearchStore from 'app/stores/formSearchStore';
import replaceRouterParams from 'app/utils/replaceRouterParams';

class FormSource extends Component {
  static propTypes = {
    // search term
    query: PropTypes.string,

    // fuse.js options
    searchOptions: PropTypes.object,

    // list of form fields to search
    searchMap: PropTypes.array,

    /**
     * Render function that passes:
     * `isLoading` - loading state
     * `allResults` - All results returned from all queries: [searchIndex, model, type]
     * `results` - Results array filtered by `this.props.query`: [searchIndex, model, type]
     */
    children: PropTypes.func.isRequired,
  };

  static defaultProps = {
    searchOptions: {},
  };

  constructor(props, ...args) {
    super(props, ...args);

    this.state = {
      fuzzy: null,
    };

    this.createSearch(props.searchMap);
  }

  UNSAFE_componentWillReceiveProps(nextProps) {
    if (this.props.searchMap !== nextProps.searchMap) {
      this.createSearch(nextProps.searchMap);
    }
  }

  async createSearch(searchMap) {
    this.setState({
      fuzzy: await createFuzzySearch(searchMap || [], {
        ...this.props.searchOptions,
        keys: ['title', 'description'],
      }),
    });
  }

  render() {
    const {searchMap, query, params, children} = this.props;

    const results =
      searchMap && this.state.fuzzy
        ? this.state.fuzzy.search(query).map(({item, ...rest}) => ({
            item: {
              ...item,
              sourceType: 'field',
              resultType: 'field',
              to: `${replaceRouterParams(item.route, params)}#${encodeURIComponent(
                item.field.name
              )}`,
            },
            ...rest,
          })) || []
        : null;

    return children({
      isLoading: searchMap === null,
      allResults: searchMap,
      results,
    });
  }
}

const FormSourceContainer = withRouter(
  createReactClass({
    displayName: 'FormSourceContainer',
    mixins: [Reflux.connect(FormSearchStore, 'searchMap')],

    componentDidMount() {
      // Loads form fields
      loadSearchMap();
    },

    render() {
      return <FormSource searchMap={this.state.searchMap} {...this.props} />;
    },
  })
);

export default FormSourceContainer;
