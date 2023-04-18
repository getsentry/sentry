import queryString from 'query-string';

import ListLink from 'sentry/components/links/listLink';
import ScrollableTabs from 'sentry/components/replays/scrollableTabs';
import {t} from 'sentry/locale';
import trackAdvancedAnalyticsEvent from 'sentry/utils/analytics/trackAdvancedAnalyticsEvent';
import useActiveReplayTab, {TabKey} from 'sentry/utils/replays/hooks/useActiveReplayTab';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';

const ReplayTabs: Record<TabKey, string> = {
  [TabKey.console]: t('Console'),
  [TabKey.network]: t('Network'),
  [TabKey.dom]: t('DOM Events'),
  [TabKey.issues]: t('Issues'),
  [TabKey.memory]: t('Memory'),
  [TabKey.trace]: t('Trace'),
};

type Props = {
  className?: string;
};

function FocusTabs({className}: Props) {
  const organization = useOrganization();
  const {pathname, query} = useLocation();
  const {getActiveTab, setActiveTab} = useActiveReplayTab();
  const activeTab = getActiveTab();

  return (
    <ScrollableTabs className={className} underlined>
      {Object.entries(ReplayTabs).map(([tab, label]) => (
        <ListLink
          key={tab}
          isActive={() => tab === activeTab}
          to={`${pathname}?${queryString.stringify({...query, t_main: tab})}`}
          onClick={e => {
            e.preventDefault();
            setActiveTab(tab);

            trackAdvancedAnalyticsEvent('replay.details-tab-changed', {
              tab,
              organization,
            });
          }}
        >
          {label}
        </ListLink>
      ))}
    </ScrollableTabs>
  );
}

export default FocusTabs;
