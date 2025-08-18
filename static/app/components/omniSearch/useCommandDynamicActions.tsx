import {useCallback, useEffect, useMemo, useState} from 'react';

import {addErrorMessage, addSuccessMessage} from 'sentry/actionCreators/indicator';
import {openHelpSearchModal} from 'sentry/actionCreators/modal';
import {openSudo} from 'sentry/actionCreators/sudoModal';
import {Client} from 'sentry/api';
import {makeResolvedTs} from 'sentry/components/search/sources/utils';
import {NODE_ENV, USING_CUSTOMER_DOMAIN} from 'sentry/constants';
import {IconTerminal} from 'sentry/icons';
import {t, toggleLocaleDebug} from 'sentry/locale';
import ConfigStore from 'sentry/stores/configStore';
import type {ProjectKey} from 'sentry/types/project';
import type {User} from 'sentry/types/user';
import type {Fuse} from 'sentry/utils/fuzzySearch';
import {createFuzzySearch} from 'sentry/utils/fuzzySearch';
import {removeBodyTheme} from 'sentry/utils/removeBodyTheme';
import {useParams} from 'sentry/utils/useParams';
import {useUser} from 'sentry/utils/useUser';

import type {OmniAction} from './types';

type Action = {
  action: () => void;
  description: string;
  requiresSuperuser: boolean;
  title: string;
  isHidden?: () => boolean;
};

type CommandItem = {
  action: () => void;
  description: string;
  resolvedTs: number;
  resultType: string;
  sourceType: string;
  title: string;
};

function getActions(params: {orgId?: string; projectId?: string}): Action[] {
  const actions: Action[] = [
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
      description: t('Toggle dark mode'),
      requiresSuperuser: false,
      action: async () => {
        removeBodyTheme();
        ConfigStore.set('theme', ConfigStore.get('theme') === 'dark' ? 'light' : 'dark');
        const api = new Client();
        await api
          .requestPromise('/users/me/', {
            method: 'PUT',
            data: {options: {theme: ConfigStore.get('theme')}},
          })
          .then((u: User) => {
            ConfigStore.set('user', u);
            addSuccessMessage(t('Theme updated successfully'));
          })
          .catch(() => {
            addErrorMessage(t('Failed to update theme'));
          });
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

    actions.push({
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

  // Copy DSN action
  if (params.orgId && params.projectId) {
    actions.push({
      title: t('Copy Project (%s) DSN to Clipboard', params.projectId),
      description: t('Copies the Project DSN to the clipboard.'),
      requiresSuperuser: false,
      action: async () => {
        const api = new Client();
        const data: ProjectKey[] = await api.requestPromise(
          `/projects/${params.orgId}/${params.projectId}/keys/`
        );

        const dsn = data?.[0]?.dsn?.public;
        if (dsn) {
          await navigator.clipboard.writeText(dsn);
          addSuccessMessage(t('DSN Copied to clipboard'));
        } else {
          addErrorMessage(t('Unable to load DSN'));
        }
      },
    });
  }

  return actions;
}

/**
 * Hook that fetches command results and converts them to dynamic actions
 * for the OmniSearch palette.
 *
 * @param query - The search query string (should be debounced)
 * @returns Array of dynamic actions based on commands
 */
export function useCommandDynamicActions(query: string): OmniAction[] {
  const params = useParams<{orgId: string; projectId?: string}>();
  const user = useUser();
  const [fuzzy, setFuzzy] = useState<Fuse<CommandItem> | null>(null);

  const createSearch = useCallback(async () => {
    if (!user) {
      return;
    }

    const isSuperuser = user?.isSuperuser ?? false;
    const actions = getActions(params);

    const filteredActions = actions.filter(command => {
      if (command.requiresSuperuser && !isSuperuser) {
        return false;
      }
      if (command.isHidden?.()) {
        return false;
      }
      return true;
    });

    const resolvedTs = makeResolvedTs();
    const searchItems = filteredActions.map<CommandItem>(command => ({
      title: command.title,
      description: command.description,
      action: command.action,
      sourceType: 'command',
      resultType: 'command',
      resolvedTs,
    }));

    const search = await createFuzzySearch<CommandItem>(searchItems, {
      keys: ['title', 'description'],
    });

    setFuzzy(search);
  }, [params, user]);

  useEffect(() => {
    void createSearch();
  }, [createSearch]);

  const dynamicActions = useMemo(() => {
    if (!query || !fuzzy) {
      return [];
    }

    const results = fuzzy.search(query);

    return results.map((result, index) => {
      const item = result.item;
      return {
        key: `command-${index}`,
        areaKey: 'command',
        label: item.title,
        details: item.description,
        section: 'Commands',
        actionIcon: <IconTerminal />,
        onAction: item.action,
      } as OmniAction;
    });
  }, [query, fuzzy]);

  return dynamicActions;
}
