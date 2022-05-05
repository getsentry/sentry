import React from 'react';
import styled from '@emotion/styled';

import NavTabs from 'sentry/components/navTabs';
import {t} from 'sentry/locale';
import space from 'sentry/styles/space';

import {TabBarId} from '../types';

type Props = {
  active: TabBarId;
  setActive: (id: TabBarId) => void;
};

function FocusTabs({active, setActive}: Props) {
  const select = (barId: TabBarId) => () => {
    setActive(barId);
  };

  return (
    <FullBleedNavTabs underlined>
      <li className={active === 'console' ? 'active' : ''}>
        <a href="#console" onClick={select('console')}>
          {t('Console')}
        </a>
      </li>
      <li className={active === 'performance' ? 'active' : ''}>
        <a href="#performance" onClick={select('performance')}>
          {t('Performance')}
        </a>
      </li>
      <li className={active === 'issues' ? 'active' : ''}>
        <a href="#issues" onClick={select('issues')}>
          {t('Issues')}
        </a>
      </li>
      <li className={active === 'tags' ? 'active' : ''}>
        <a href="#tags" onClick={select('tags')}>
          {t('Tags')}
        </a>
      </li>
      <li className={active === 'memory' ? 'active' : ''}>
        <a href="#memory" onClick={select('memory')}>
          {t('Memory')}
        </a>
      </li>
    </FullBleedNavTabs>
  );
}

const FullBleedNavTabs = styled(NavTabs)`
  margin-inline: -${space(4)};
  padding-inline: ${space(4)};
`;

export default FocusTabs;
