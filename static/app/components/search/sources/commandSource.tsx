import {useCallback, useEffect, useMemo, useState} from 'react';

import {addErrorMessage, addSuccessMessage} from 'sentry/actionCreators/indicator';
import {openHelpSearchModal} from 'sentry/actionCreators/modal';
import {openSudo} from 'sentry/actionCreators/sudoModal';
import type {Client} from 'sentry/api';
import {NODE_ENV, USING_CUSTOMER_DOMAIN} from 'sentry/constants';
import {t, toggleLocaleDebug} from 'sentry/locale';
import ConfigStore from 'sentry/stores/configStore';
import type {ProjectKey} from 'sentry/types/project';
import type {Fuse} from 'sentry/utils/fuzzySearch';
import {createFuzzySearch} from 'sentry/utils/fuzzySearch';
import {removeBodyTheme} from 'sentry/utils/removeBodyTheme';
import useApi from 'sentry/utils/useApi';
import {useParams} from 'sentry/utils/useParams';
import {useUser} from 'sentry/utils/useUser';

import type {ChildProps, ResultItem} from './types';
import {makeResolvedTs} from './utils';

type Action = {
  action: () => void;
  description: string;
  isVisible: boolean;
  requiresSuperuser: boolean;
  title: string;
};

const ACTIONS: Action[] = [
  {
    title: t('Open Sudo Modal'),
    description: t('Open Sudo Modal to re-identify yourself.'),
    isVisible: true,
    requiresSuperuser: false,
    action: () =>
      openSudo({
        sudo: true,
      }),
  },

  {
    title: t('Open Superuser Modal'),
    description: t('Open Superuser Modal to re-identify yourself.'),
    isVisible: true,
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
    isVisible: true,
    requiresSuperuser: false,
    action: () => {
      removeBodyTheme();
      ConfigStore.set('theme', ConfigStore.get('theme') === 'dark' ? 'light' : 'dark');
    },
  },

  {
    title: t('Toggle Translation Markers'),
    description: t('Toggles translation markers on or off in the application'),
    isVisible: true,
    requiresSuperuser: true,
    action: () => {
      toggleLocaleDebug();
      window.location.reload();
    },
  },

  {
    title: t('Search Documentation and FAQ'),
    description: t('Open the Documentation and FAQ search modal.'),
    isVisible: true,
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
    isVisible: true,
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

function createCopyDSNAction(
  api: Client,
  orgId: string | undefined,
  projectId: string | undefined
) {
  return {
    title: t('Copy Project DSN to Clipboard'),
    description: t('Copies the Project DSN to the clipboard.'),
    isVisible: !!orgId && !!projectId,
    requiresSuperuser: false,
    action: async () => {
      const data: ProjectKey[] = await api.requestPromise(
        `/projects/${orgId}/${projectId}/keys/`
      );

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
  /**
   * params obtained from the current route
   */
  params: {
    orgId?: string;
    projectId?: string;
  };
  /**
   * search term
   */
  query: string;
  /**
   * fuse.js options
   */
  searchOptions?: Fuse.IFuseOptions<Action>;
};

/**
 * This source is a hardcoded list of action creators and/or routes maybe
 */
function CommandSource({searchOptions, query, children}: Props) {
  const {isSuperuser} = useUser();
  const [fuzzy, setFuzzy] = useState<Fuse<Action> | null>(null);
  const params = useParams();
  const api = useApi();

  const createSearch = useCallback(async () => {
    const copyDSNAction = createCopyDSNAction(api, params.orgId, params.projectId);
    setFuzzy(
      await createFuzzySearch<Action>([...ACTIONS, copyDSNAction], {
        ...searchOptions,
        keys: ['title', 'description'],
      })
    );
  }, [searchOptions, api, params.orgId, params.projectId]);

  useEffect(() => void createSearch(), [createSearch]);

  const results = useMemo(() => {
    const resolvedTs = makeResolvedTs();
    return (
      fuzzy
        ?.search(query)
        .filter(({item}) => !item.requiresSuperuser || isSuperuser)
        .filter(({item}) => item.isVisible)
        .map(({item, ...rest}) => ({
          item: {
            ...item,
            sourceType: 'command',
            resultType: 'command',
            resolvedTs,
          } as ResultItem,
          ...rest,
        })) ?? []
    );
  }, [fuzzy, query, isSuperuser]);

  return children({isLoading: fuzzy === null, results});
}

export default CommandSource;
