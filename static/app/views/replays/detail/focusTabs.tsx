import React from 'react';
import styled from '@emotion/styled';

import NavTabs from 'sentry/components/navTabs';
import {t} from 'sentry/locale';
import space from 'sentry/styles/space';

import {TabBarId} from '../types';

type Props = {
  active: TabBarId;
};

function FocusTabs({active}: Props) {
  return (
    <FullBleedNavTabs underlined>
      <li className={active === 'console' ? 'active' : ''}>
        <a href="#console">{t('Console')}</a>
      </li>
      <li className={active === 'performance' ? 'active' : ''}>
        <a href="#performance">{t('Performance')}</a>
      </li>
      <li className={active === 'errors' ? 'active' : ''}>
        <a href="#errors">{t('Errors')}</a>
      </li>
      <li className={active === 'tags' ? 'active' : ''}>
        <a href="#tags">{t('Tags')}</a>
      </li>
      <li className={active === 'memory' ? 'active' : ''}>
        <a href="#memory">{t('Memory')}</a>
      </li>
    </FullBleedNavTabs>
  );
}

const FullBleedNavTabs = styled(NavTabs)`
  margin-inline: -${space(4)};
  padding-inline: ${space(4)};
`;

export default FocusTabs;
