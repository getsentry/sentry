import {Component} from 'react';

import {addErrorMessage, addSuccessMessage} from 'sentry/actionCreators/indicator';
import {openHelpSearchModal} from 'sentry/actionCreators/modal';
import {openSudo} from 'sentry/actionCreators/sudoModal';
import {Client} from 'sentry/api';
import Access from 'sentry/components/acl/access';
import {NODE_ENV, USING_CUSTOMER_DOMAIN} from 'sentry/constants';
import {t, toggleLocaleDebug} from 'sentry/locale';
import ConfigStore from 'sentry/stores/configStore';
import type {PlainRoute} from 'sentry/types/legacyReactRouter';
import type {Organization} from 'sentry/types/organization';
import type {ProjectKey} from 'sentry/types/project';
import type {Fuse} from 'sentry/utils/fuzzySearch';
import {createFuzzySearch} from 'sentry/utils/fuzzySearch';
import {removeBodyTheme} from 'sentry/utils/removeBodyTheme';
import withLatestContext from 'sentry/utils/withLatestContext';

import type {ChildProps, ResultItem} from './types';

type Action = {
  action: () => void;
  description: string;
  requiresSuperuser: boolean;
  title: string;
};

const ACTIONS: Action[] = [
  {
    title: t('Open Sudo Modal'),
    description: t('Open Sudo Modal to re-identify yourself.'),
    requiresSuperuser: false,
    action: () =>
      openSudo({
        sudo: true,
      }),
  },

  {
    title: t('Open Superuser Modal'),
    description: t('Open Superuser Modal to re-identify yourself.'),
    requiresSuperuser: true,
    action: () =>
      openSudo({
        isSuperuser: true,
        needsReload: true,
      }),
  },

  {
    title: t('Toggle dark mode'),
    description: t('Toggle dark mode (superuser only atm)'),
    requiresSuperuser: false,
    action: () => {
      removeBodyTheme();
      ConfigStore.set('theme', ConfigStore.get('theme') === 'dark' ? 'light' : 'dark');
    },
  },

  {
    title: t('Toggle Translation Markers'),
    description: t('Toggles translation markers on or off in the application'),
    requiresSuperuser: true,
    action: () => {
      toggleLocaleDebug();
      window.location.reload();
    },
  },

  {
    title: t('Search Documentation and FAQ'),
    description: t('Open the Documentation and FAQ search modal.'),
    requiresSuperuser: false,
    action: () => {
      openHelpSearchModal();
    },
  },
];

// Add a command palette option for opening in production when using dev-ui
if (NODE_ENV === 'development' && window?.__initialData?.isSelfHosted === false) {
  const customerUrl = new URL(
    USING_CUSTOMER_DOMAIN && window?.__initialData?.customerDomain?.organizationUrl
      ? window.__initialData.customerDomain.organizationUrl
      : window.__initialData?.links?.sentryUrl
  );

  ACTIONS.push({
    title: t('Open in Production'),
    description: t('Open the current page in sentry.io'),
    requiresSuperuser: false,
    action: () => {
      const url = new URL(window.location.toString());
      url.host = customerUrl.host;
      url.protocol = customerUrl.protocol;
      url.port = '';
      window.open(url.toString(), '_blank');
    },
  });
}

async function createCopyDSNAction(api: Client, orgId: string, projectId: string) {
  const data: ProjectKey[] = await api.requestPromise(
    `/projects/${orgId}/${projectId}/keys/`
  );

  return {
    title: t('Copy Project DSN to Clipboard'),
    description: t('Copies the Project DSN to the clipboard.'),
    requiresSuperuser: false,
    action: () => {
      if (data.length > 0 && data[0]?.dsn?.public) {
        navigator.clipboard.writeText(data[0]?.dsn?.public);
        addSuccessMessage(t('Copied DSN to clipboard'));
      } else {
        addErrorMessage(t('No DSN found for project'));
      }
    },
  };
}

type Props = {
  children: (props: ChildProps) => React.ReactElement;
  isSuperuser: boolean;
  organization: Organization;
  /**
   * params obtained from the current route
   */
  params: {
    orgId: string;
    projectId?: string;
  };
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
class CommandSource extends Component<Props, State> {
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

  api = new Client();

  async createSearch(searchMap: Action[]) {
    const searchActions = [...searchMap];
    const {orgId, projectId} = this.props.params;
    if (orgId && projectId) {
      // only show copy DSN action if we have an org and project in the url
      const copyDSNAction = await createCopyDSNAction(this.api, orgId, projectId);
      searchActions.push(copyDSNAction);
    }

    const options = {
      ...this.props.searchOptions,
      keys: ['title', 'description'],
    };
    this.setState({
      fuzzy: await createFuzzySearch<Action>(searchActions, options),
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

function CommandSourceWithFeature(props: Omit<Props, 'isSuperuser'>) {
  return (
    <Access access={[]} isSuperuser>
      {({hasSuperuser}) => <CommandSource {...props} isSuperuser={hasSuperuser} />}
    </Access>
  );
}
export default withLatestContext(CommandSourceWithFeature);
export {CommandSource};
