import React from 'react';
import {storiesOf} from '@storybook/react';
import {withInfo} from '@storybook/addon-info';
import styled from 'react-emotion';

import InlineSvg from 'app/components/inlineSvg';

storiesOf('Style|Icons', module).add(
  'SVG',
  withInfo('All SVG icons, to be used with `InlineSvg`')(() => {
    const context = require.context('app/icons', true, /\.svg/);
    const icons = context.keys().map(key => key.replace('./', '').replace('.svg', ''));

    return (
      <Swatches>
        {icons.map(icon => (
          <Swatch key={icon}>
            <IconWrapper>
              <InlineSvg height={20} width={20} src={icon} />
            </IconWrapper>
            <Text>{icon.replace('icon-', '')}</Text>
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

const IconWrapper = styled('div')`
  display: flex;
  flex: 1;
  align-items: center;
  justify-content: center;
`;

const Swatch = styled('div')`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background-color: white;
  border: 1px solid ${p => p.theme.borderLight};
  color: ${p => p.theme.gray5};
  height: 80px;
  text-align: center;
  word-break: break-all;
  line-height: 1.4em;
`;

const Text = styled('div')`
  font-size: 10px;
  white-space: nowrap;
`;
