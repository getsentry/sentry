import React from 'react';

import NavTabs from 'sentry/components/navTabs';
import {t} from 'sentry/locale';
import useActiveTabFromLocation from 'sentry/utils/replays/hooks/useActiveTabFromLocation';

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
  const active = useActiveTabFromLocation();
  return (
    <NavTabs underlined>
      {TABS.map(tab => (
        <li key={tab} className={active === tab.toLowerCase() ? 'active' : ''}>
          <a href={`#${tab.toLowerCase()}`}>{tab}</a>
        </li>
      ))}
    </NavTabs>
  );
}

export default FocusTabs;
