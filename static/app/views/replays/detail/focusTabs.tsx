import React from 'react';
import styled from '@emotion/styled';

import NavTabs from 'sentry/components/navTabs';
import {t} from 'sentry/locale';
import space from 'sentry/styles/space';

import useActiveTabFromLocation from './useActiveTabFromLocation';

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
    <FullBleedNavTabs underlined>
      {TABS.map(tab => (
        <li key={tab} className={active === tab.toLowerCase() ? 'active' : ''}>
          <a href={`#${tab.toLowerCase()}`}>{tab}</a>
        </li>
      ))}
    </FullBleedNavTabs>
  );
}

const FullBleedNavTabs = styled(NavTabs)`
  margin-inline: -${space(4)};
  padding-inline: ${space(4)};
`;

export default FocusTabs;
