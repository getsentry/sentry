import React from 'react';
import {storiesOf} from '@storybook/react';
import {withInfo} from '@storybook/addon-info';
import styled from '@emotion/styled';

import theme from 'app/utils/theme';

storiesOf('Style|Colors', module).add(
  'default',
  withInfo('Top level colors')(() => {
    const colorsToDisplay = Object.entries(theme).filter(([_name, val]) => {
      return typeof val === 'string' && val.match(/^\#[0-9a-fA-F]{6}$/);
    });

    return (
      <Swatches>
        {colorsToDisplay.map(([name, color]) => (
          <Swatch key={name} color={color}>
            {name}
          </Swatch>
        ))}
      </Swatches>
    );
  })
);

const Swatches = styled('div')`
  display: grid;
  grid-template-columns: repeat(auto-fill, 80px);
  grid-gap: 16px;
`;

const Swatch = styled('div')`
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: ${p => p.color};
  color: ${p => (p.color[1].match(/[0-8]{1}/) ? p.theme.gray100 : p.theme.gray800)};
  font-size: ${p => p.theme.fontSizeSmall};
  height: 80px;
  text-align: center;
  word-break: break-all;
  line-height: 1.4em;
`;
