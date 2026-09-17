import {useCallback} from 'react';
import {parseAsBoolean, parseAsString, useQueryStates} from 'nuqs';

import {useDrawer} from '@sentry/scraps/drawer';

import {SeerDrawer} from 'sentry/components/events/autofix/v3/drawer';
import {t} from 'sentry/locale';
import type {Group} from 'sentry/types/group';
import type {Project} from 'sentry/types/project';
import {normalizeUrl} from 'sentry/utils/url/normalizeUrl';
import {useNavigate} from 'sentry/utils/useNavigate';
import {useOrganization} from 'sentry/utils/useOrganization';
import {hasAutofixPage, makeSeerLocation} from 'sentry/views/issueDetails/autofix/utils';

export const useOpenSeerDrawer = ({group, project}: {group: Group; project: Project}) => {
  const {openDrawer} = useDrawer();
  const [{seerDrawer, seerDrawerAction}, setDrawerQuery] = useQueryStates(
    {
      seerDrawer: parseAsBoolean.withDefault(false),
      seerDrawerAction: parseAsString,
    },
    {shallow: false}
  );
  const organization = useOrganization();
  const navigate = useNavigate();

  const openSeerDrawer = useCallback(() => {
    if (
      !organization.features.includes('gen-ai-features') ||
      organization.hideAiFeatures
    ) {
      return;
    }

    // Autofix has its own page behind the flag, so every entry point that used
    // to open the drawer navigates there instead — including legacy
    // `?seerDrawer=true` URLs, which land here and get forwarded.
    if (hasAutofixPage(organization)) {
      navigate(
        makeSeerLocation({
          organization,
          groupId: group.id,
          action: seerDrawerAction ?? undefined,
        }),
        {replace: seerDrawer}
      );
      return;
    }

    const issueBaseUrl = normalizeUrl(
      `/organizations/${organization.slug}/issues/${group.id}/`
    );
    openDrawer(() => <SeerDrawer group={group} project={project} />, {
      ariaLabel: t('Seer drawer'),
      drawerKey: 'seer-autofix-drawer',
      drawerWidth: '80%',
      drawerMaxWidth: '1600px',
      resizable: true,
      mode: 'passive',
      shouldCloseOnLocationChange: nextLocation => {
        const nextPath = nextLocation.pathname.endsWith('/')
          ? nextLocation.pathname
          : `${nextLocation.pathname}/`;
        return !nextPath.startsWith(issueBaseUrl);
      },
      onClose: () => {
        void setDrawerQuery(
          {seerDrawer: null, seerDrawerAction: null},
          {history: 'replace'}
        );
      },
    });

    if (!seerDrawer) {
      void setDrawerQuery({seerDrawer: true}, {history: 'push'});
    }
  }, [
    openDrawer,
    group,
    project,
    seerDrawer,
    seerDrawerAction,
    setDrawerQuery,
    organization,
    navigate,
  ]);

  return {openSeerDrawer};
};
