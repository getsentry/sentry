import {useEffect, useRef} from 'react';

import {useDrawer} from '@sentry/scraps/drawer';

import {SeerDrawer} from 'sentry/components/events/autofix/v3/drawer';
import {LoadingError} from 'sentry/components/loadingError';
import {LoadingIndicator} from 'sentry/components/loadingIndicator';
import {t} from 'sentry/locale';
import {decodeScalar} from 'sentry/utils/queryString';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
import {useOrganization} from 'sentry/utils/useOrganization';
import {useGroup} from 'sentry/views/issueDetails/useGroup';

function SeerDrawerLoader({groupId}: {groupId: string}) {
  const {data: group, isPending, isError} = useGroup({groupId});

  if (isPending) {
    return <LoadingIndicator />;
  }
  if (isError || !group) {
    return <LoadingError />;
  }
  return <SeerDrawer group={group} project={group.project} />;
}

export function useOverviewSeerDrawer() {
  const {openDrawer, isAnyDrawerOpen} = useDrawer();
  const organization = useOrganization();
  const location = useLocation();
  const navigate = useNavigate();
  const locationRef = useRef(location);
  useEffect(() => {
    locationRef.current = location;
  });
  const openGroupIdRef = useRef<string | undefined>(undefined);

  const hasSeerAccess =
    organization.features.includes('gen-ai-features') && !organization.hideAiFeatures;
  const groupId = decodeScalar(location.query.seerDrawer);

  useEffect(() => {
    if (!groupId) {
      return;
    }
    const pathname = locationRef.current.pathname;
    const clearSeerDrawer = () =>
      navigate(
        {pathname, query: {...locationRef.current.query, seerDrawer: undefined}},
        {replace: true, preventScrollReset: true}
      );

    if (!hasSeerAccess) {
      clearSeerDrawer();
      return;
    }
    if (isAnyDrawerOpen && openGroupIdRef.current === groupId) {
      return;
    }
    openGroupIdRef.current = groupId;
    openDrawer(() => <SeerDrawerLoader groupId={groupId} />, {
      ariaLabel: t('Seer drawer'),
      drawerKey: 'seer-autofix-drawer',
      drawerWidth: '80%',
      drawerMaxWidth: '1600px',
      resizable: true,
      mode: 'passive',
      shouldCloseOnLocationChange: nextLocation =>
        nextLocation.pathname !== pathname ||
        decodeScalar(nextLocation.query.seerDrawer) !== groupId,
      onClose: () => {
        openGroupIdRef.current = undefined;
        clearSeerDrawer();
      },
    });
  }, [groupId, hasSeerAccess, isAnyDrawerOpen, openDrawer, navigate]);
}
