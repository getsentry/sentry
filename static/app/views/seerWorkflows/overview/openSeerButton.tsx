import {useCallback, useMemo} from 'react';

import {LinkButton} from '@sentry/scraps/button';
import {Tooltip} from '@sentry/scraps/tooltip';

import {IconSeer} from 'sentry/icons';
import {t} from 'sentry/locale';
import {trackAnalytics} from 'sentry/utils/analytics';
import {useLocation} from 'sentry/utils/useLocation';
import {useOrganization} from 'sentry/utils/useOrganization';

import type {AutofixStateKey, OverviewRun} from './types';

export function useOpenSeerLink(run: OverviewRun, section: AutofixStateKey) {
  const organization = useOrganization();
  const location = useLocation();
  const to = useMemo(
    () => ({
      pathname: location.pathname,
      query: {...location.query, seerDrawer: run.groupId},
    }),
    [location.pathname, location.query, run.groupId]
  );
  const trackOpen = useCallback(
    () =>
      trackAnalytics('autofix.overview.open_seer_clicked', {
        organization,
        group_id: run.groupId,
        run_id: run.seerRunId,
        section,
      }),
    [organization, run.groupId, run.seerRunId, section]
  );
  return {to, trackOpen};
}

export function OpenSeerButton({
  run,
  section,
  size,
  variant = 'secondary',
}: {
  run: OverviewRun;
  section: AutofixStateKey;
  size: 'xs' | 'sm';
  variant?: 'primary' | 'secondary';
}) {
  const {to, trackOpen} = useOpenSeerLink(run, section);
  return (
    <Tooltip title={t('Open Seer')} skipWrapper>
      <LinkButton
        size={size}
        variant={variant}
        aria-label={t('Open Seer')}
        icon={<IconSeer size="sm" />}
        to={to}
        onClick={trackOpen}
      />
    </Tooltip>
  );
}
