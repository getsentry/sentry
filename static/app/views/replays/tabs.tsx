import {TabList, Tabs} from 'sentry/components/tabs';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';

const TABS = [
  {key: 'replays', label: 'Replays', to: ''},
  {key: 'selectors', label: 'Selectors', to: 'dead-rage-clicks'},
];

export default function ReplayTabs() {
  const organization = useOrganization();
  const hasDeadClickFeature = organization.features.includes(
    'session-replay-rage-dead-selectors'
  );

  const location = useLocation();
  const {pathname} = location;
  const isSelectorIndex = pathname.includes('dead-rage-clicks');

  return hasDeadClickFeature ? (
    <Tabs value={isSelectorIndex ? 'selectors' : 'replays'}>
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
