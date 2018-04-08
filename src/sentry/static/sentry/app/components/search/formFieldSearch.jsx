import {withRouter} from 'react-router';
import PropTypes from 'prop-types';
import React from 'react';
import Reflux from 'reflux';
import createReactClass from 'create-react-class';

import {createFuzzySearch} from '../../utils/createFuzzySearch';
import FormSearchStore from '../../stores/formSearchStore';
import replaceRouterParams from '../../utils/replaceRouterParams';

class FormFieldSearch extends React.Component {
  static propTypes = {
    searchMap: PropTypes.array,

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
      fuzzy: null,
    };

    this.createSearch(props.searchMap);
  }

  componentWillReceiveProps(nextProps) {
    if (this.props.searchMap !== nextProps.searchMap) {
      this.createSearch(nextProps.searchMap);
    }
  }

  async createSearch(searchMap) {
    this.setState({
      fuzzy: await createFuzzySearch(searchMap || [], {
        keys: ['field.label', 'field.help'],
      }),
    });
  }

  render() {
    let {searchMap, query, params, children} = this.props;

    let results =
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

const FormFieldSearchContainer = withRouter(
  createReactClass({
    displayName: 'FormFieldSearchContainer',
    mixins: [Reflux.connect(FormSearchStore, 'searchMap')],
    render() {
      return <FormFieldSearch searchMap={this.state.searchMap} {...this.props} />;
    },
  })
);

export default FormFieldSearchContainer;
