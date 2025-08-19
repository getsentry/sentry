import {useMemo} from 'react';

import {addErrorMessage, addSuccessMessage} from 'sentry/actionCreators/indicator';
import {openHelpSearchModal} from 'sentry/actionCreators/modal';
import {openSudo} from 'sentry/actionCreators/sudoModal';
import {Client} from 'sentry/api';
import {NODE_ENV, USING_CUSTOMER_DOMAIN} from 'sentry/constants';
import {IconTerminal} from 'sentry/icons';
import {t, toggleLocaleDebug} from 'sentry/locale';
import type {ProjectKey} from 'sentry/types/project';
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
 * Hook that provides all commands as OmniActions for the OmniSearch palette.
 * No filtering is done here - palette.tsx handles the search.
 *
 * @returns Array of all available command actions
 */
export function useCommandDynamicActions(): OmniAction[] {
  const params = useParams<{orgId: string; projectId?: string}>();
  const user = useUser();

  const dynamicActions = useMemo(() => {
    if (!user) {
      return [];
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

    return filteredActions.map((command, index) => ({
      key: `command-${index}`,
      areaKey: 'global',
      label: command.title,
      details: command.description,
      section: 'Commands',
      actionIcon: <IconTerminal />,
      onAction: command.action,
    }));
  }, [params, user]);

  return dynamicActions;
}
