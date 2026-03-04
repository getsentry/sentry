import {useCallback} from 'react';
import {css} from '@emotion/react';

import {SeerDrawer as LegacySeerDrawer} from 'sentry/components/events/autofix/v1/drawer';
import {SeerDrawer as ExplorerSeerDrawer} from 'sentry/components/events/autofix/v2/drawer';
import useDrawer from 'sentry/components/globalDrawer';
import {t} from 'sentry/locale';
import type {Event} from 'sentry/types/event';
import type {Group} from 'sentry/types/group';
import type {Project} from 'sentry/types/project';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
import useOrganization from 'sentry/utils/useOrganization';

interface SeerDrawerProps {
  event: Event;
  group: Group;
  project: Project;
}

export function SeerDrawer({group, project, event}: SeerDrawerProps) {
  const organization = useOrganization();

  if (organization.features.includes('autofix-on-explorer')) {
    return <ExplorerSeerDrawer event={event} group={group} project={project} />;
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
  const organization = useOrganization();

  const openSeerDrawer = useCallback(() => {
    if (
      !event ||
      !organization.features.includes('gen-ai-features') ||
      organization.hideAiFeatures
    ) {
      return;
    }

    openDrawer(() => <SeerDrawer group={group} project={project} event={event} />, {
      ariaLabel: t('Seer drawer'),
      drawerKey: 'seer-autofix-drawer',
      drawerCss: css`
        height: fit-content;
        max-height: 100%;
      `,
      resizable: true,
      shouldCloseOnInteractOutside: () => {
        return false;
      },
      onClose: () => {
        navigate(
          {
            pathname: location.pathname,
            query: {
              ...location.query,
              seerDrawer: undefined,
            },
          },
          {replace: true, preventScrollReset: true}
        );
      },
    });
  }, [openDrawer, event, group, project, location, navigate, organization]);

  return {openSeerDrawer};
};
