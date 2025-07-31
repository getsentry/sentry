import {TabList} from 'sentry/components/core/tabs';
import {Tooltip} from 'sentry/components/core/tooltip';
import * as Layout from 'sentry/components/layouts/thirds';
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

  return (
    <Layout.HeaderTabs value={selected}>
      <TabList hideBorder>
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

        <TabList.Item
          key="selectors"
          to={{
            ...location,
            pathname: makeReplaysPathname({
              path: '/selectors/',
              organization,
            }),
            query: {...location.query, sort: '-count_dead_clicks'},
          }}
          disabled={allMobileProj}
        >
          <Tooltip
            disabled={!allMobileProj}
            title={t('Selectors are not available with mobile replays')}
          >
            {t('Selectors')}
          </Tooltip>
        </TabList.Item>
      </TabList>
    </Layout.HeaderTabs>
  );
}
