import {useCallback, useRef} from 'react';

import {useDrawer} from '@sentry/scraps/drawer';

import {SeerDrawer} from 'sentry/components/events/autofix/v3/drawer';
import {t} from 'sentry/locale';
import type {Group} from 'sentry/types/group';
import type {Project} from 'sentry/types/project';
import {normalizeUrl} from 'sentry/utils/url/normalizeUrl';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
import {useOrganization} from 'sentry/utils/useOrganization';

export const useOpenSeerDrawer = ({group, project}: {group: Group; project: Project}) => {
  const {openDrawer} = useDrawer();
  const navigate = useNavigate();
  const location = useLocation();
  const locationRef = useRef(location); // prevents stale location in onClose
  locationRef.current = location; // sync on every render
  const organization = useOrganization();

  const openSeerDrawer = useCallback(() => {
    if (
      !organization.features.includes('gen-ai-features') ||
      organization.hideAiFeatures
    ) {
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
        navigate(
          {
            pathname: locationRef.current.pathname,
            query: {
              ...locationRef.current.query,
              seerDrawer: undefined,
              seerDrawerAction: undefined,
            },
          },
          {replace: true, preventScrollReset: true}
        );
      },
    });

    if (locationRef.current.query.seerDrawer !== 'true') {
      navigate({
        pathname: locationRef.current.pathname,
        query: {
          ...locationRef.current.query,
          seerDrawer: true,
        },
      });
    }
  }, [openDrawer, group, project, navigate, organization]);

  return {openSeerDrawer};
};
