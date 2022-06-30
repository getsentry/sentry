import {MouseEvent} from 'react';
import styled from '@emotion/styled';

import NavTabs from 'sentry/components/navTabs';
import {t} from 'sentry/locale';
import useActiveReplayTab, {
  ReplayTabs,
} from 'sentry/utils/replays/hooks/useActiveReplayTab';

type Props = {};

const TABS = [
  t('Console'),
  t('Network'),
  t('Trace'),
  t('Issues'),
  t('Tags'),
  t('Memory'),
];

function FocusTabs({}: Props) {
  const {activeTab, setActiveTab} = useActiveReplayTab();

  return (
    <NavTabs underlined>
      {TABS.map(tab => (
        <Tab key={tab} className={activeTab === tab.toLowerCase() ? 'active' : ''}>
          <a
            href={`#${tab.toLowerCase()}`}
            onClick={(e: MouseEvent) => {
              setActiveTab(tab.toLowerCase() as ReplayTabs);
              e.preventDefault();
            }}
          >
            {tab}
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
