import {useCallback, useRef} from 'react';

import {useDrawer} from '@sentry/scraps/drawer';

import {SeerDrawer as LegacySeerDrawer} from 'sentry/components/events/autofix/v1/drawer';
import {SeerDrawer as ExplorerSeerDrawer} from 'sentry/components/events/autofix/v3/drawer';
import {t} from 'sentry/locale';
import type {Event} from 'sentry/types/event';
import type {Group} from 'sentry/types/group';
import type {Project} from 'sentry/types/project';
import {normalizeUrl} from 'sentry/utils/url/normalizeUrl';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
import {useOrganization} from 'sentry/utils/useOrganization';

interface SeerDrawerProps {
  event: Event;
  group: Group;
  project: Project;
}

export function SeerDrawer({group, project, event}: SeerDrawerProps) {
  const organization = useOrganization();

  if (organization.features.includes('autofix-on-explorer')) {
    return <ExplorerSeerDrawer group={group} project={project} />;
  }

  return <LegacySeerDrawer event={event} group={group} project={project} />;
}

export const useOpenSeerDrawer = ({
  group,
  project,
  event,
}: {
  event: Event | null;
  group: Group;
  project: Project;
  buttonRef?: React.RefObject<HTMLButtonElement | null>;
}) => {
  const {openDrawer} = useDrawer();
  const navigate = useNavigate();
  const location = useLocation();
  const locationRef = useRef(location); // prevents stale location in onClose
  locationRef.current = location; // sync on every render
  const organization = useOrganization();

  const openSeerDrawer = useCallback(() => {
    if (
      !event ||
      !organization.features.includes('gen-ai-features') ||
      organization.hideAiFeatures
    ) {
      return;
    }

    const issueBaseUrl = normalizeUrl(
      `/organizations/${organization.slug}/issues/${group.id}/`
    );

    openDrawer(() => <SeerDrawer group={group} project={project} event={event} />, {
      ariaLabel: t('Seer drawer'),
      drawerKey: 'seer-autofix-drawer',
      resizable: true,
      mode: 'passive',
      shouldCloseOnLocationChange: nextLocation => {
        const nextPath = nextLocation.pathname.endsWith('/')
          ? nextLocation.pathname
          : `${nextLocation.pathname}/`;
        return !nextPath.startsWith(issueBaseUrl);
      },
      onClose: () => {
        navigate(
          {
            pathname: locationRef.current.pathname,
            query: {
              ...locationRef.current.query,
              seerDrawer: undefined,
            },
          },
          {replace: true, preventScrollReset: true}
        );
      },
    });
  }, [openDrawer, event, group, project, navigate, organization]);

  return {openSeerDrawer};
};
