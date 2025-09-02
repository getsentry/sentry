import {TabList} from 'sentry/components/core/tabs';
import * as Layout from 'sentry/components/layouts/thirds';
import {t} from 'sentry/locale';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import {makeReplaysPathname} from 'sentry/views/replays/pathnames';

interface Props {
  selected: 'replays' | 'selectors';
}

export default function ReplayTabs({selected}: Props) {
  const organization = useOrganization();
  const location = useLocation();

  return (
    <Layout.HeaderTabs value={selected}>
      <TabList>
        <TabList.Item
          key="replays"
          to={{
            ...location,
            pathname: makeReplaysPathname({
              path: '/',
              organization,
            }),
            query: {...location.query, sort: undefined},
          }}
        >
          {t('Replays')}
        </TabList.Item>
      </TabList>
    </Layout.HeaderTabs>
  );
}
