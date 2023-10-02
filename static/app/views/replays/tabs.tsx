import {TabList, Tabs} from 'sentry/components/tabs';
import useOrganization from 'sentry/utils/useOrganization';

interface Props {
  selected: 'replays' | 'selectors';
}

const SELECTOR_IDX_ROUTE = 'selectors';
const REPLAY_IDX_ROUTE = '';

const TABS = [
  {key: 'replays', label: 'Replays', to: REPLAY_IDX_ROUTE},
  {key: 'selectors', label: 'Selectors', to: SELECTOR_IDX_ROUTE},
];

export default function ReplayTabs({selected}: Props) {
  const organization = useOrganization();
  const hasDeadClickFeature = organization.features.includes(
    'session-replay-rage-dead-selectors'
  );

  return hasDeadClickFeature ? (
    <Tabs value={selected}>
      <TabList hideBorder>
        {TABS.map(tab => (
          <TabList.Item
            key={tab.key}
            to={`/organizations/${organization.slug}/replays/${tab.to}`}
          >
            {tab.label}
          </TabList.Item>
        ))}
      </TabList>
    </Tabs>
  ) : null;
}
