import React from 'react';
import styled from '@emotion/styled';

import Switch from 'app/components/switch';
import space from 'app/styles/space';

import {LEGACY_BROWSER_LIST} from '../utils';

type Browser = keyof typeof LEGACY_BROWSER_LIST;

type Props = {
  browser: Browser;
  isEnabled: boolean;
  onToggle: () => void;
};

function LegacyBrowser({browser, isEnabled, onToggle}: Props) {
  const {icon, title} = LEGACY_BROWSER_LIST[browser];
  return (
    <React.Fragment>
      <BrowserWrapper>
        <Icon className={`icon-${icon}`} />
        {title}
      </BrowserWrapper>
      <SwitchWrapper>
        <Switch size="lg" isActive={isEnabled} toggle={onToggle} />
      </SwitchWrapper>
    </React.Fragment>
  );
}

export default LegacyBrowser;

const BrowserWrapper = styled('div')`
  display: grid;
  grid-template-columns: max-content 1fr;
  grid-column-gap: ${space(1)};
  align-items: center;
  font-size: ${p => p.theme.fontSizeLarge};
`;

const Icon = styled('div')`
  width: 24px;
  height: 24px;
  background-repeat: no-repeat;
  background-position: center;
  background-size: 24px 24px;
  flex-shrink: 0;
`;

const SwitchWrapper = styled('div')`
  display: flex;
  justify-content: flex-end;
  align-items: center;
`;
