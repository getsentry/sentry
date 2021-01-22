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
  const {icon, title, description} = LEGACY_BROWSER_LIST[browser];
  return (
    <React.Fragment>
      <BrowserWrapper>
        <Icon className={`icon-${icon}`} />
        <Details>
          <Title>{title}</Title>
          <Description>{description}</Description>
        </Details>
      </BrowserWrapper>
      <SwitchWrapper>
        <Switch isActive={isEnabled} toggle={onToggle} />
      </SwitchWrapper>
    </React.Fragment>
  );
}

export default LegacyBrowser;

const BrowserWrapper = styled('div')`
  display: grid;
  grid-template-columns: max-content 1fr;
  grid-gap: ${space(1)};
  align-items: center;
`;

const Icon = styled('div')`
  width: 30px;
  height: 30px;
  background-repeat: no-repeat;
  background-position: center;
  background-size: 30px 30px;
  flex-shrink: 0;
`;

const Details = styled('div')`
  display: flex;
  flex-direction: column;
  font-size: ${p => p.theme.fontSizeMedium};
  line-height: 1;
`;

const Title = styled('div')`
  font-weight: 600;
`;

const Description = styled('div')`
  color: ${p => p.theme.gray400};
  font-size: ${p => p.theme.fontSizeSmall};
`;

const SwitchWrapper = styled('div')`
  display: flex;
  justify-content: flex-end;
  align-items: center;
`;
