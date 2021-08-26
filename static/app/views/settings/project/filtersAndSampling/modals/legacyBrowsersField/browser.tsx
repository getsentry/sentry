import {Fragment} from 'react';
import styled from '@emotion/styled';

import Switch from 'app/components/switchButton';
import space from 'app/styles/space';
import {LegacyBrowser} from 'app/types/dynamicSampling';

import {LEGACY_BROWSER_LIST} from '../utils';

type Props = {
  browser: LegacyBrowser;
  isEnabled: boolean;
  onToggle: () => void;
};

function Browser({browser, isEnabled, onToggle}: Props) {
  const {icon, title} = LEGACY_BROWSER_LIST[browser];
  return (
    <Fragment>
      <BrowserWrapper>
        <Icon className={`icon-${icon}`} />
        {title}
      </BrowserWrapper>
      <SwitchWrapper>
        <Switch size="lg" isActive={isEnabled} toggle={onToggle} />
      </SwitchWrapper>
    </Fragment>
  );
}

export default Browser;

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
