import {MouseEvent} from 'react';

import NavTabs from 'sentry/components/navTabs';
import {t} from 'sentry/locale';
import useActiveReplayTab, {TabKey} from 'sentry/utils/replays/hooks/useActiveReplayTab';

const ReplayTabs: Record<TabKey, string> = {
  console: t('Console'),
  dom: t('DOM Events'),
  network: t('Network'),
  trace: t('Trace'),
  issues: t('Issues'),
  memory: t('Memory'),
};

type Props = {};

function FocusTabs({}: Props) {
  const {getActiveTab, setActiveTab} = useActiveReplayTab();
  const activeTab = getActiveTab();
  return (
    <NavTabs underlined>
      {Object.entries(ReplayTabs).map(([tab, label]) => (
        <li key={tab} className={activeTab === tab ? 'active' : ''}>
          <a
            href={`#${tab}`}
            onClick={(e: MouseEvent) => {
              setActiveTab(tab);
              e.preventDefault();
            }}
          >
            <span>{label}</span>
          </a>
        </li>
      ))}
    </NavTabs>
  );
}

export default FocusTabs;
