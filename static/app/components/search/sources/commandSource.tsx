import {useCallback, useEffect, useMemo, useState} from 'react';

import {openHelpSearchModal} from 'sentry/actionCreators/modal';
import {openSudo} from 'sentry/actionCreators/sudoModal';
import {NODE_ENV, USING_CUSTOMER_DOMAIN} from 'sentry/constants';
import {t, toggleLocaleDebug} from 'sentry/locale';
import ConfigStore from 'sentry/stores/configStore';
import type {Fuse} from 'sentry/utils/fuzzySearch';
import {createFuzzySearch} from 'sentry/utils/fuzzySearch';
import {removeBodyTheme} from 'sentry/utils/removeBodyTheme';
import {useUser} from 'sentry/utils/useUser';

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

type Props = {
  children: (props: ChildProps) => React.ReactElement;
  isSuperuser: boolean;
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

  const createSearch = useCallback(async () => {
    setFuzzy(
      await createFuzzySearch<Action>(ACTIONS || [], {
        ...searchOptions,
        keys: ['title', 'description'],
      })
    );
  }, [searchOptions]);

  useEffect(() => void createSearch(), [createSearch]);

  const results = useMemo(
    () =>
      fuzzy
        ?.search(query)
        .filter(({item}) => !item.requiresSuperuser || isSuperuser)
        .map(({item, ...rest}) => ({
          item: {
            ...item,
            sourceType: 'command',
            resultType: 'command',
          } as ResultItem,
          ...rest,
        })) ?? [],
    [fuzzy, query, isSuperuser]
  );

  return children({isLoading: fuzzy === null, results});
}

export default CommandSource;
