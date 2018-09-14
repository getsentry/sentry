import React from 'react';
import {storiesOf} from '@storybook/react';
import {withInfo} from '@storybook/addon-info';
import styled from 'react-emotion';
import {Flex} from 'grid-emotion';

import InlineSvg from 'app/components/inlineSvg';

storiesOf('Style|Icons', module).add(
  'SVG',
  withInfo('All SVG icons, to be used with `InlineSvg`')(() => {
    const context = require.context('app/icons', true, /\.svg/);
    const icons = context.keys().map(key => key.replace('./', '').replace('.svg', ''));

    return (
      <Flex wrap="wrap">
        {icons.map(icon => (
          <Swatch key={icon} align="center" justify="center">
            <Flex flex={1} align="center" justify="center">
              <InlineSvg height={20} width={20} src={icon} />
            </Flex>
            <Text>{icon.replace('icon-', '')}</Text>
          </Swatch>
        ))}
      </Flex>
    );
  })
);

const Swatch = styled(Flex)`
  flex-direction: column;
  background-color: white;
  border: 1px solid ${p => p.theme.borderLight};
  color: ${p => p.theme.gray5};
  width: 80px;
  height: 80px;
  margin: 8px;
  padding: 8px;
  text-align: center;
  word-break: break-all;
  line-height: 1.4em;
`;

const Text = styled('div')`
  font-size: 10px;
  white-space: nowrap;
`;
