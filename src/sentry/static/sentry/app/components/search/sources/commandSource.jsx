import PropTypes from 'prop-types';
import React from 'react';

import {createFuzzySearch} from 'app/utils/createFuzzySearch';
import {openSudo} from 'app/actionCreators/modal';
import Feature from 'app/components/feature';

const ACTIONS = [
  {
    title: 'Open Sudo Modal',
    description: 'Open Sudo Modal to re-identify yourself.',
    action: () =>
      openSudo({
        sudo: true,
      }),
  },

  {
    title: 'Open Superuser Modal',
    description: 'Open Superuser Modal to re-identify yourself.',
    requiresSuperuser: true,
    action: () =>
      openSudo({
        superuser: true,
      }),
  },
];

/**
 * This source is a hardcoded list of action creators and/or routes maybe
 */
class CommandSource extends React.Component {
  static propTypes = {
    // search term
    query: PropTypes.string,

    // fuse.js options
    searchOptions: PropTypes.object,

    // Array of routes to search
    searchMap: PropTypes.array,

    isSuperuser: PropTypes.bool,

    /**
     * Render function that passes:
     * `isLoading` - loading state
     * `allResults` - All results returned from all queries: [searchIndex, model, type]
     * `results` - Results array filtered by `this.props.query`: [searchIndex, model, type]
     */
    children: PropTypes.func.isRequired,
  };

  static defaultProps = {
    searchMap: [],
    searchOptions: {},
  };

  constructor(...args) {
    super(...args);

    this.state = {
      fuzzy: null,
    };
  }

  componentDidMount() {
    this.createSearch(ACTIONS);
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
    let {searchMap, query, isSuperuser, children} = this.props;

    let results =
      (this.state.fuzzy &&
        this.state.fuzzy
          .search(query)
          .filter(({item, ...rest}) => !item.requiresSuperuser || isSuperuser)
          .map(({item, ...rest}) => ({
            item: {
              ...item,
              sourceType: 'command',
              resultType: 'command',
            },
            ...rest,
          }))) ||
      [];

    return children({
      isLoading: searchMap === null,
      allResults: searchMap,
      results,
    });
  }
}

const CommandSourceWithFeature = props => (
  <Feature isSuperuser>
    {({hasSuperuser}) => <CommandSource {...props} isSuperuser={hasSuperuser} />}
  </Feature>
);

export default CommandSourceWithFeature;
export {CommandSource};
