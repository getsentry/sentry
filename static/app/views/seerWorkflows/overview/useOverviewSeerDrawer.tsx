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

// Opens the Seer drawer in place when ?seerDrawer=<groupId> is set, so the
// overview stays put instead of navigating to the issue page. The group id lets
// a reload reopen the drawer for the same run.
export function useOverviewSeerDrawer() {
  const {openDrawer} = useDrawer();
  const organization = useOrganization();
  const location = useLocation();
  const navigate = useNavigate();
  const locationRef = useRef(location);
  useEffect(() => {
    locationRef.current = location;
  });

  const hasSeerAccess =
    organization.features.includes('gen-ai-features') && !organization.hideAiFeatures;
  const groupId = decodeScalar(location.query.seerDrawer);

  // The group id lives in the URL so a reload or a second card reopens the
  // drawer for that run.
  useEffect(() => {
    if (!groupId || !hasSeerAccess) {
      return;
    }
    const pathname = locationRef.current.pathname;
    openDrawer(() => <SeerDrawerLoader groupId={groupId} />, {
      ariaLabel: t('Seer drawer'),
      drawerKey: 'seer-autofix-drawer',
      resizable: true,
      mode: 'passive',
      // Close when leaving the overview or when the param stops pointing here, so
      // browser back/forward can't orphan the drawer.
      shouldCloseOnLocationChange: nextLocation =>
        nextLocation.pathname !== pathname ||
        decodeScalar(nextLocation.query.seerDrawer) !== groupId,
      onClose: () =>
        navigate(
          {pathname, query: {...locationRef.current.query, seerDrawer: undefined}},
          {replace: true, preventScrollReset: true}
        ),
    });
  }, [groupId, hasSeerAccess, openDrawer, navigate]);
}
