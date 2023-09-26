import {TabList, Tabs} from 'sentry/components/tabs';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';

const TABS = [
  {key: '', label: 'Replays'},
  {key: 'dead-clicks', label: 'Selectors'},
];

export default function ReplayTabs() {
  const organization = useOrganization();
  const hasDeadClickFeature = organization.features.includes(
    'session-replay-rage-dead-selectors'
  );

  const location = useLocation();
  const {pathname} = location;
  const isSelectorIndex = pathname.includes('dead-clicks');

  return hasDeadClickFeature ? (
    <Tabs value={isSelectorIndex ? 'dead-clicks' : ''}>
      <TabList hideBorder>
        {TABS.map(tab => (
          <TabList.Item
            key={tab.key}
            to={`/organizations/${organization.slug}/replays/${tab.key}`}
          >
            {tab.label}
          </TabList.Item>
        ))}
      </TabList>
    </Tabs>
  ) : null;
}
