import {useMemo} from 'react';

import * as Layout from 'sentry/components/layouts/thirds';
import {TabList} from 'sentry/components/tabs';
import {t} from 'sentry/locale';
import {useLocation} from 'sentry/utils/useLocation';

interface Props {
  selected: string;
}

export default function TraceExplorerTabs({selected}: Props) {
  const location = useLocation();

  const tabs = useMemo(
    () => [
      {
        key: 'spans',
        label: t('Spans'),
        query: {...location.query, exploreTab: 'spans'},
      },
      {
        key: 'logs',
        label: t('Logs'),
        query: {...location.query, exploreTab: 'logs'},
      },
    ],
    [location.query]
  );

  return (
    <Layout.HeaderTabs value={selected}>
      <TabList hideBorder>
        {tabs.map(tab => (
          <TabList.Item
            key={tab.key}
            to={{
              ...location,
              query: tab.query,
            }}
          >
            {tab.label}
          </TabList.Item>
        ))}
      </TabList>
    </Layout.HeaderTabs>
  );
}
