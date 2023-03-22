import {MouseEvent} from 'react';
import styled from '@emotion/styled';
import queryString from 'query-string';

import NavTabs from 'sentry/components/navTabs';
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
    <ScrollableNavTabs underlined className={className}>
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
    </ScrollableNavTabs>
  );
}

const ScrollableNavTabs = styled(NavTabs)`
  display: flex;
  flex-wrap: nowrap;
  overflow-y: hidden;
  overflow-x: auto;
  white-space: nowrap;
`;

export default FocusTabs;
