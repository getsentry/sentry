import {useMemo} from 'react';

import * as Layout from 'sentry/components/layouts/thirds';
import {TabList} from 'sentry/components/tabs';
import {t} from 'sentry/locale';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import useAllMobileProj from 'sentry/views/replays/detail/useAllMobileProj';
import {makeReplaysPathname} from 'sentry/views/replays/pathnames';

interface Props {
  selected: 'replays' | 'selectors';
}

export default function ReplayTabs({selected}: Props) {
  const organization = useOrganization();
  const location = useLocation();
  const {allMobileProj} = useAllMobileProj({});

  const replaysPathname = makeReplaysPathname({
    path: '/',
    organization,
  });

  const selectorsPathname = makeReplaysPathname({
    path: '/selectors/',
    organization,
  });

  const tabs = useMemo(
    () => [
      {
        key: 'replays',
        label: t('Replays'),
        pathname: replaysPathname,
        query: {...location.query, sort: undefined},
      },
      {
        key: 'selectors',
        label: t('Selectors'),
        pathname: selectorsPathname,
        query: {...location.query, sort: '-count_dead_clicks'},
      },
    ],
    [location.query, replaysPathname, selectorsPathname]
  );

  return (
    <Layout.HeaderTabs value={selected}>
      <TabList hideBorder>
        {tabs.map(tab => (
          <TabList.Item
            key={tab.key}
            to={{
              ...location,
              pathname: tab.pathname,
              query: tab.query,
            }}
            disabled={tab.key === 'selectors' && allMobileProj}
          >
            {tab.label}
          </TabList.Item>
        ))}
      </TabList>
    </Layout.HeaderTabs>
  );
}
