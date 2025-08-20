import {useMemo} from 'react';

import type {Crumb, CrumbDropdown} from 'sentry/components/breadcrumbs';
import {t} from 'sentry/locale';
import useOrganization from 'sentry/utils/useOrganization';
import {makeReplaysPathname} from 'sentry/views/replays/pathnames';

export default function useAssertionPageCrumbs({label}: {label?: string} = {}) {
  const organization = useOrganization();

  return useMemo(() => {
    const crumbs: Array<Crumb | CrumbDropdown> = [
      {
        label: t('Replay'),
        to: {
          pathname: makeReplaysPathname({
            path: '/',
            organization,
          }),
        },
      },
      {
        label: t('Flows'),
        to: {
          pathname: makeReplaysPathname({
            path: '/flows/table/',
            organization,
          }),
        },
      },
    ];

    if (label) {
      crumbs.push({label});
    }

    return crumbs;
  }, [label, organization]);
}
