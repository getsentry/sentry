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

function FocusButtons({active, setActive}: Props) {
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
      <li className={active === 'errors' ? 'active' : ''}>
        <a href="#errors" onClick={select('errors')}>
          {t('Errors')}
        </a>
      </li>
      <li className={active === 'tags' ? 'active' : ''}>
        <a href="#tags" onClick={select('tags')}>
          {t('Tags')}
        </a>
      </li>
    </FullBleedNavTabs>
  );
}

const FullBleedNavTabs = styled(NavTabs)`
  margin-inline: -${space(4)};
  padding-inline: ${space(4)};
`;

export default FocusButtons;
