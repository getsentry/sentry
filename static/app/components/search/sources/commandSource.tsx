import * as React from 'react';
import {PlainRoute} from 'react-router';

import {openHelpSearchModal, openSudo} from 'sentry/actionCreators/modal';
import Access from 'sentry/components/acl/access';
import {toggleLocaleDebug} from 'sentry/locale';
import ConfigStore from 'sentry/stores/configStore';
import {createFuzzySearch, Fuse} from 'sentry/utils/fuzzySearch';

import {ChildProps, ResultItem} from './types';

type Action = {
  action: () => void;
  description: string;
  requiresSuperuser: boolean;
  title: string;
};

const ACTIONS: Action[] = [
  {
    title: 'Open Sudo Modal',
    description: 'Open Sudo Modal to re-identify yourself.',
    requiresSuperuser: false,
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

  {
    title: 'Toggle dark mode',
    description: 'Toggle dark mode (superuser only atm)',
    requiresSuperuser: true,
    action: () =>
      ConfigStore.set('theme', ConfigStore.get('theme') === 'dark' ? 'light' : 'dark'),
  },

  {
    title: 'Toggle Translation Markers',
    description: 'Toggles translation markers on or off in the application',
    requiresSuperuser: true,
    action: () => {
      toggleLocaleDebug();
      window.location.reload();
    },
  },

  {
    title: 'Search Documentation and FAQ',
    description: 'Open the Documentation and FAQ search modal.',
    requiresSuperuser: false,
    action: () => {
      openHelpSearchModal();
    },
  },
];

type Props = {
  children: (props: ChildProps) => React.ReactElement;
  isSuperuser: boolean;
  /**
   * search term
   */
  query: string;
  /**
   * Array of routes to search
   */
  searchMap?: PlainRoute[];
  /**
   * fuse.js options
   */
  searchOptions?: Fuse.IFuseOptions<Action>;
};

type State = {
  fuzzy: null | Fuse<Action>;
};

/**
 * This source is a hardcoded list of action creators and/or routes maybe
 */
class CommandSource extends React.Component<Props, State> {
  static defaultProps = {
    searchMap: [],
    searchOptions: {},
  };

  state: State = {
    fuzzy: null,
  };

  componentDidMount() {
    this.createSearch(ACTIONS);
  }

  async createSearch(searchMap: Action[]) {
    const options = {
      ...this.props.searchOptions,
      keys: ['title', 'description'],
    };
    this.setState({
      fuzzy: await createFuzzySearch<Action>(searchMap || [], options),
    });
  }

  render() {
    const {searchMap, query, isSuperuser, children} = this.props;
    const {fuzzy} = this.state;

    const results =
      fuzzy
        ?.search(query)
        .filter(({item}) => !item.requiresSuperuser || isSuperuser)
        .map(value => {
          const {item, ...rest} = value;
          return {
            item: {
              ...item,
              sourceType: 'command',
              resultType: 'command',
            } as ResultItem,
            ...rest,
          };
        }) ?? [];

    return children({
      isLoading: searchMap === null,
      results,
    });
  }
}

const CommandSourceWithFeature = (props: Omit<Props, 'isSuperuser'>) => (
  <Access isSuperuser>
    {({hasSuperuser}) => <CommandSource {...props} isSuperuser={hasSuperuser} />}
  </Access>
);
export default CommandSourceWithFeature;
export {CommandSource};
