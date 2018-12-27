import React from 'react';
import {storiesOf} from '@storybook/react';
import {withInfo} from '@storybook/addon-info';
import styled from 'react-emotion';
import {Flex} from 'grid-emotion';

import theme from 'app/utils/theme';

storiesOf('Style|Colors', module).add(
  'default',
  withInfo('Top level colors')(() => {
    const colorsToDisplay = Object.entries(theme).filter(([_name, val]) => {
      return typeof val === 'string' && val.match(/^\#[0-9a-fA-F]{6}$/);
    });

    return (
      <Flex wrap="wrap">
        {colorsToDisplay.map(([name, color]) => (
          <Swatch key={name} color={color} align="center" justify="center">
            {name}
          </Swatch>
        ))}
      </Flex>
    );
  })
);

const Swatch = styled(Flex)`
  background-color: ${p => p.color};
  color: ${p => (p.color[1].match(/[0-8]{1}/) ? p.theme.offWhite : p.theme.gray5)};
  font-size: ${p => p.theme.fontSizeSmall};
  width: 80px;
  height: 80px;
  margin: 8px;
  padding: 8px;
  text-align: center;
  word-break: break-all;
  line-height: 1.4em;
`;
