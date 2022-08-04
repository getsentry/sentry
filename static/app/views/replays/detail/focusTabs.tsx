import {MouseEvent} from 'react';

import NavTabs from 'sentry/components/navTabs';
import useActiveReplayTab, {
  ReplayTabs,
} from 'sentry/utils/replays/hooks/useActiveReplayTab';

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
