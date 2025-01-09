import {useMemo} from 'react';

import * as Layout from 'sentry/components/layouts/thirds';
import {TabList} from 'sentry/components/tabs';
import {t} from 'sentry/locale';
import normalizeUrl from 'sentry/utils/url/normalizeUrl';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import useAllMobileProj from 'sentry/views/replays/detail/useAllMobileProj';

interface Props {
  selected: 'replays' | 'selectors';
}

export default function ReplayTabs({selected}: Props) {
  const organization = useOrganization();
  const location = useLocation();
  const {allMobileProj} = useAllMobileProj({});

  const tabs = useMemo(
    () => [
      {
        key: 'replays',
        label: t('Replays'),
        pathname: normalizeUrl(`/organizations/${organization.slug}/replays/`),
        query: {...location.query, sort: undefined},
      },
      {
        key: 'selectors',
        label: t('Selectors'),
        pathname: normalizeUrl(`/organizations/${organization.slug}/replays/selectors/`),
        query: {...location.query, sort: '-count_dead_clicks'},
      },
    ],
    [organization.slug, location.query]
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
