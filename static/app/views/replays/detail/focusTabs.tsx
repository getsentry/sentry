import {MouseEvent} from 'react';
import styled from '@emotion/styled';
import queryString from 'query-string';

import NavTabs from 'sentry/components/navTabs';
import {t} from 'sentry/locale';
import useActiveReplayTab, {TabKey} from 'sentry/utils/replays/hooks/useActiveReplayTab';
import {useLocation} from 'sentry/utils/useLocation';

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
  const {pathname, query} = useLocation();
  const {getActiveTab, setActiveTab} = useActiveReplayTab();
  const activeTab = getActiveTab();

  return (
    <ScrollableNavTabs underlined className={className}>
      {Object.entries(ReplayTabs).map(([tab, label]) => (
        <li key={tab} className={activeTab === tab ? 'active' : ''}>
          <a
            href={`${pathname}?${queryString.stringify({...query, t_main: tab})}`}
            onClick={(e: MouseEvent) => {
              setActiveTab(tab);
              e.preventDefault();
            }}
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
