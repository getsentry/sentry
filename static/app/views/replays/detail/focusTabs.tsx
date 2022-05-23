import React from 'react';

import NavTabs from 'sentry/components/navTabs';
import useActiveTabFromLocation from 'sentry/components/replays/hooks/useActiveTabFromLocation';
import {t} from 'sentry/locale';

type Props = {};

const TABS = [
  t('Console'),
  t('Performance'),
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
