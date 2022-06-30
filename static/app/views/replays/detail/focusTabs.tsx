import {MouseEvent} from 'react';
import styled from '@emotion/styled';

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
        <Tab key={tab} className={activeTab === tab ? 'active' : ''}>
          <a
            href={`#${tab}`}
            onClick={(e: MouseEvent) => {
              setActiveTab(tab as keyof typeof ReplayTabs);
              e.preventDefault();
            }}
          >
            {label}
          </a>
        </Tab>
      ))}
    </NavTabs>
  );
}

const Tab = styled('li')`
  z-index: ${p => p.theme.zIndex.initial + 1};
`;

export default FocusTabs;
