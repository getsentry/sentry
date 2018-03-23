import {withRouter} from 'react-router';
import PropTypes from 'prop-types';
import React from 'react';
import Reflux from 'reflux';
import createReactClass from 'create-react-class';

import FormSearchStore from '../../stores/formSearchStore';
import replaceRouterParams from '../../utils/replaceRouterParams';

class FormFieldSearch extends React.Component {
  static propTypes = {
    searchMap: PropTypes.object,

    query: PropTypes.string,
    /**
     * Render function that passes:
     * `isLoading` - loading state
     * `allResults` - All results returned from all queries: [searchIndex, model, type]
     * `results` - Results array filtered by `this.props.query`: [searchIndex, model, type]
     */
    children: PropTypes.func.isRequired,
  };

  render() {
    let {searchMap, query, params, children} = this.props;

    let results = searchMap
      ? Object.keys(searchMap)
          .filter(key => key.indexOf(query) > -1)
          .map(key => searchMap[key])
          .map(item => ({
            sourceType: 'field',
            resultType: 'field',
            ...item,
            to: `${replaceRouterParams(item.route, params)}#${encodeURIComponent(
              item.field.name
            )}`,
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
