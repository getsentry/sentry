import React from 'react';
import {withInfo} from '@storybook/addon-info';
import styled from '@emotion/styled';

import * as newIconset from 'app/icons';

export default {
  title: 'Core/Style/Icons',
};

export const IconSet = withInfo('Replace `InlineSvg` with icon components')(() => {
  return (
    <SwatchWrapper>
      <Header>Icon Set</Header>
      <Swatches>
        {Object.entries(newIconset).map(([key, Icon]) => (
          <Swatch key={key}>
            <Icon />
            <LabelWrapper>{key}</LabelWrapper>
          </Swatch>
        ))}
      </Swatches>
    </SwatchWrapper>
  );
});

const Header = styled('h5')`
  margin-bottom: 16px;
`;

const LabelWrapper = styled('div')`
  font-size: 14px;
  margin-left: 16px;
`;

const SwatchWrapper = styled('div')`
  border: 1px solid ${p => p.theme.border};
  padding: 24px;
`;

const Swatches = styled('div')`
  display: grid;
  grid-template-columns: repeat(auto-fill, 160px);
  grid-gap: 8px;
`;

const Swatch = styled('div')`
  display: flex;
  align-items: center;
  min-height: 32px;

  svg {
    min-width: 32px;
  }
`;
