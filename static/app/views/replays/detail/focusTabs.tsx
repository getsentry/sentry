import {MouseEvent} from 'react';
import queryString from 'query-string';

import NavTabs from 'sentry/components/navTabs';
import {t} from 'sentry/locale';
import trackAdvancedAnalyticsEvent from 'sentry/utils/analytics/trackAdvancedAnalyticsEvent';
import useActiveReplayTab, {TabKey} from 'sentry/utils/replays/hooks/useActiveReplayTab';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';

const ReplayTabs: Record<TabKey, string> = {
  console: t('Console'),
  dom: t('DOM Events'),
  network: t('Network'),
  trace: t('Trace'),
  issues: t('Issues'),
  memory: t('Memory'),
};

type Props = {className?: string};

function FocusTabs({className}: Props) {
  const organization = useOrganization();
  const {pathname, query} = useLocation();
  const {getActiveTab, setActiveTab} = useActiveReplayTab();
  const activeTab = getActiveTab();

  const createTabChangeHandler = (tab: string) => (e: MouseEvent) => {
    e.preventDefault();
    setActiveTab(tab);

    trackAdvancedAnalyticsEvent('replay.details-tab-changed', {
      tab,
      organization,
    });
  };

  return (
    <NavTabs underlined className={className}>
      {Object.entries(ReplayTabs).map(([tab, label]) => (
        <li key={tab} className={activeTab === tab ? 'active' : ''}>
          <a
            href={`${pathname}?${queryString.stringify({...query, t_main: tab})}`}
            onClick={createTabChangeHandler(tab)}
          >
            <span>{label}</span>
          </a>
        </li>
      ))}
    </NavTabs>
  );
}

export default FocusTabs;
