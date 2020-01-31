import React from 'react';
import {storiesOf} from '@storybook/react';
import {withInfo} from '@storybook/addon-info';
import styled from '@emotion/styled';

import * as newIconset from 'app/icons';

storiesOf('Style|Icons', module).add(
  'SVG',
  withInfo('Replace `InlineSvg` with IconComponent')(() => {
    return (
      <div>
        <h4>New Icons</h4>
        <Swatches>
          {Object.entries(newIconset).map(([key, Icon]) => (
            <Swatch key={key}>
              <IconWrapper>
                <Icon />
              </IconWrapper>
              <LabelWrapper>{key}</LabelWrapper>
            </Swatch>
          ))}
        </Swatches>
      </div>
    );
  })
);

const Swatches = styled('div')`
  display: grid;
  grid-template-columns: repeat(auto-fill, 160px);
  grid-gap: 8px;
  margin-bottom: 24px;
`;

const Swatch = styled('div')`
  display: flex;
  align-items: center;
  overflow: hidden;
  min-height: 32px;
`;

const IconWrapper = styled('div')`
  min-width: 40px;
`;

const LabelWrapper = styled('div')`
  font-size: 12px;
`;
