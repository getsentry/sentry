import {useEffect, useEffectEvent, useMemo, useRef} from 'react';
import * as Sentry from '@sentry/react';
import {skipToken, useQuery} from '@tanstack/react-query';

import {useDrawer} from '@sentry/scraps/drawer';

import type {IndexedMembersByProject} from 'sentry/actionCreators/members';
import {t} from 'sentry/locale';
import {apiOptions} from 'sentry/utils/api/apiOptions';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
import {useOrganization} from 'sentry/utils/useOrganization';
import {SupergroupDetailDrawer} from 'sentry/views/issueList/supergroups/supergroupDrawer';
import type {SupergroupDetail} from 'sentry/views/issueList/supergroups/types';
import type {SupergroupLookup} from 'sentry/views/issueList/supergroups/useSuperGroups';

export const SUPERGROUP_DRAWER_QUERY_PARAM = 'supergroupDrawer';

interface UseSupergroupDrawerOptions {
  lookup: SupergroupLookup;
  memberList: IndexedMembersByProject;
}

export function useSupergroupDrawer({lookup, memberList}: UseSupergroupDrawerOptions) {
  const organization = useOrganization();
  const location = useLocation();
  const navigate = useNavigate();
  const {openDrawer} = useDrawer();

  const hasTopIssuesUI = organization.features.includes('top-issues-ui');

  const queryParam = location.query[SUPERGROUP_DRAWER_QUERY_PARAM];
  const drawerSupergroupId =
    hasTopIssuesUI && typeof queryParam === 'string' ? queryParam : undefined;

  const lookupSupergroup = useMemo(() => {
    if (!drawerSupergroupId) {
      return undefined;
    }
    for (const sg of Object.values(lookup)) {
      if (sg && String(sg.id) === drawerSupergroupId) {
        return sg;
      }
    }
    return undefined;
  }, [drawerSupergroupId, lookup]);

  const {data: fetchedSupergroupResponse, isError} = useQuery(
    apiOptions.as<{data: SupergroupDetail}>()(
      '/organizations/$organizationIdOrSlug/seer/supergroups/$supergroupId/',
      {
        path:
          drawerSupergroupId && !lookupSupergroup
            ? {
                organizationIdOrSlug: organization.slug,
                supergroupId: drawerSupergroupId,
              }
            : skipToken,
        staleTime: 30_000,
      }
    )
  );

  const fetchedSupergroup = fetchedSupergroupResponse?.data;
  const supergroup = lookupSupergroup ?? fetchedSupergroup;

  const stripDrawerParam = useEffectEvent(() => {
    navigate(
      {
        pathname: location.pathname,
        query: {
          ...location.query,
          [SUPERGROUP_DRAWER_QUERY_PARAM]: undefined,
        },
      },
      {replace: true, preventScrollReset: true}
    );
  });

  const lastOpenedIdRef = useRef<string | undefined>(undefined);

  useEffect(() => {
    if (!hasTopIssuesUI) {
      return;
    }
    if (!drawerSupergroupId) {
      lastOpenedIdRef.current = undefined;
      return;
    }

    if (lastOpenedIdRef.current === drawerSupergroupId) {
      return;
    }

    if (!supergroup) {
      if (isError) {
        stripDrawerParam();
      }
      return;
    }

    lastOpenedIdRef.current = drawerSupergroupId;
    Sentry.getReplay()?.start();
    openDrawer(
      () => (
        <SupergroupDetailDrawer
          supergroup={supergroup}
          memberList={memberList}
          filterWithCurrentSearch
        />
      ),
      {
        ariaLabel: t('Issue group details'),
        drawerKey: 'supergroup-drawer',
        shouldCloseOnInteractOutside: el =>
          !document.getElementById('modal-portal')?.contains(el) &&
          !el.closest('[data-overlay]'),
        shouldCloseOnLocationChange: nextLocation =>
          !nextLocation.query[SUPERGROUP_DRAWER_QUERY_PARAM],
        onClose: () => stripDrawerParam(),
      }
    );
  }, [hasTopIssuesUI, drawerSupergroupId, supergroup, isError, memberList, openDrawer]);
}
