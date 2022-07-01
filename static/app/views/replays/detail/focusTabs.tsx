import React from 'react';
import styled from '@emotion/styled';

import NavTabs from 'sentry/components/navTabs';
import {t} from 'sentry/locale';
import useActiveTabFromLocation from 'sentry/utils/replays/hooks/useActiveTabFromLocation';

type Props = {};

const TABS = [
  t('Console'),
  t('Network'),
  t('Network 2'),
  t('Trace'),
  t('Issues'),
  t('Tags'),
  t('Memory'),
];

function FocusTabs({}: Props) {
  const active = useActiveTabFromLocation();
  return (
    <NavTabs underlined>
      {TABS.map(tab => (
        <Tab key={tab} className={active === tab.toLowerCase() ? 'active' : ''}>
          <a href={`#${tab.toLowerCase()}`}>{tab}</a>
        </Tab>
      ))}
    </NavTabs>
  );
}

const Tab = styled('li')`
  z-index: ${p => p.theme.zIndex.initial + 1};
`;

export default FocusTabs;
