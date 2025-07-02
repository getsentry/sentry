import {TabList} from 'sentry/components/core/tabs';
import * as Layout from 'sentry/components/layouts/thirds';
import {t} from 'sentry/locale';
import {useLocation} from 'sentry/utils/useLocation';

interface Props {
  selected: 'flow-definitions' | 'flow-instances';
}

export default function FlowsTabs({selected}: Props) {
  const location = useLocation();

  return (
    <Layout.HeaderTabs value={selected}>
      <TabList hideBorder>
        <TabList.Item
          key="flow-definitions"
          to={{
            ...location,
            pathname: '/flows/definitions/',
            query: {...location.query, sort: undefined},
          }}
        >
          {t('Flows')}
        </TabList.Item>
      </TabList>
    </Layout.HeaderTabs>
  );
}
