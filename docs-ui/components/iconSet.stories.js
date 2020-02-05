import React from 'react';
import {storiesOf} from '@storybook/react';
import {withInfo} from '@storybook/addon-info';
import styled from '@emotion/styled';

import * as newIconset from 'app/icons';

storiesOf('Style|Icons', module).add(
  'Icon Set',
  withInfo('Replace `InlineSvg` with the new Icon Components')(() => {
    return (
      <div>
        <Header>Circle Prop</Header>
        <Swatches>
          {Object.entries(newIconset).map(([key, Icon]) => (
            <Swatch key={key}>
              <Icon />
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
`;

const Swatch = styled('div')`
  display: flex;
  align-items: center;
  overflow: hidden;
  min-height: 32px;
`;

const LabelWrapper = styled('div')`
  font-size: 12px;
  margin-left: 16px;
`;

const Header = styled('h5')`
  margin-bottom: 8px;
`;
