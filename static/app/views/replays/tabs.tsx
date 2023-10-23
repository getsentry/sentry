import FeatureBadge from 'sentry/components/featureBadge';
import {TabList, Tabs} from 'sentry/components/tabs';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import {normalizeUrl} from 'sentry/utils/withDomainRequired';

interface Props {
  selected: 'replays' | 'selectors';
}

const SELECTOR_IDX_ROUTE = 'selectors/';
const REPLAY_IDX_ROUTE = '';

const TABS = [
  {key: 'replays', label: 'Replays', badge: null, to: REPLAY_IDX_ROUTE},
  {
    key: 'selectors',
    label: 'Selectors',
    badge: <FeatureBadge type="new" />,
    to: SELECTOR_IDX_ROUTE,
  },
];

export default function ReplayTabs({selected}: Props) {
  const organization = useOrganization();
  const hasDeadClickFeature = organization.features.includes(
    'session-replay-rage-dead-selectors'
  );
  const location = useLocation();

  return hasDeadClickFeature ? (
    <Tabs value={selected}>
      <TabList hideBorder>
        {TABS.map(tab => (
          <TabList.Item
            key={tab.key}
            to={{
              ...location,
              query: location.query,
              pathname: normalizeUrl(
                `/organizations/${organization.slug}/replays/${tab.to}`
              ),
            }}
          >
            {tab.label}
            {tab.badge}
          </TabList.Item>
        ))}
      </TabList>
    </Tabs>
  ) : null;
}
