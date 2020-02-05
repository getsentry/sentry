import React from 'react';
import {storiesOf} from '@storybook/react';
import {withInfo} from '@storybook/addon-info';
import styled from '@emotion/styled';

import {IconAdd, IconArrow, IconBookmark, IconGroup, IconPin} from 'app/icons';

storiesOf('Style|Icons', module).add(
  'Icon Props',
  withInfo('These are the props you can assign to the icon components')(() => {
    return (
      <div>
        <Examples>
          <Header>Circle Prop</Header>
          <Swatch>
            <IconAdd />
            <LabelWrapper>IconAdd</LabelWrapper>
          </Swatch>
          <Swatch>
            <IconAdd circle />
            <LabelWrapper>IconPin</LabelWrapper>
          </Swatch>
        </Examples>
        <Examples>
          <Header>Color Prop</Header>
          <Swatch>
            <IconBookmark solid />
            <LabelWrapper>IconBookmark</LabelWrapper>
          </Swatch>
          <Swatch>
            <IconBookmark solid color="#6C5FC7" />
            <LabelWrapper>IconBookmark</LabelWrapper>
          </Swatch>
        </Examples>
        <Examples>
          <Header>Solid Prop</Header>
          <Swatch>
            <IconPin />
            <LabelWrapper>IconPin</LabelWrapper>
          </Swatch>
          <Swatch>
            <IconPin solid />
            <LabelWrapper>IconPin</LabelWrapper>
          </Swatch>
        </Examples>
        <Examples>
          <Header>Directionality Prop</Header>
          <Swatch>
            <IconArrow />
            <LabelWrapper>IconArrow</LabelWrapper>
          </Swatch>
          <Swatch>
            <IconArrow direction="left" />
            <LabelWrapper>IconArrow</LabelWrapper>
          </Swatch>
          <Swatch>
            <IconArrow direction="down" />
            <LabelWrapper>IconArrow</LabelWrapper>
          </Swatch>
          <Swatch>
            <IconArrow direction="right" />
            <LabelWrapper>IconArrow</LabelWrapper>
          </Swatch>
        </Examples>
        <Examples>
          <Header>Size Prop</Header>
          <Swatch>
            <IconGroup size="xs" />
            <LabelWrapper>IconGroup size="xs"</LabelWrapper>
          </Swatch>
          <Swatch>
            <IconGroup />
            <LabelWrapper>IconGroup</LabelWrapper>
          </Swatch>
          <Swatch>
            <IconGroup size="md" />
            <LabelWrapper>IconGroup size="md"</LabelWrapper>
          </Swatch>
          <Swatch>
            <IconGroup size="lg" />
            <LabelWrapper>IconGroup size="lg"</LabelWrapper>
          </Swatch>
          <Swatch>
            <IconGroup size="xl" />
            <LabelWrapper>IconGroup size="xl"</LabelWrapper>
          </Swatch>
        </Examples>
      </div>
    );
  })
);

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

const Examples = styled('div')`
  border: 1px solid ${p => p.theme.gray1};
  padding: 16px 24px;
`;

const Header = styled('h5')`
  margin-bottom: 8px;
`;
