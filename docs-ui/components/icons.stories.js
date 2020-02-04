import React from 'react';
import {storiesOf} from '@storybook/react';
import {withInfo} from '@storybook/addon-info';
import styled from '@emotion/styled';

import * as newIconset from 'app/icons';
import {IconAdd} from 'app/icons/iconAdd';
import {IconArrow} from 'app/icons/iconArrow';
import {IconBookmark} from 'app/icons/iconBookmark';
import {IconGroup} from 'app/icons/iconGroup';
import {IconPin} from 'app/icons/iconPin';

storiesOf('Style|Icons', module).add(
  'Icons',
  withInfo('Replace `InlineSvg` with the new Icon Components')(() => {
    return (
      <div>
        <h4>Icon Props</h4>
        <Section>
          <Examples>
            <PropHeader>Circle Prop</PropHeader>
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
            <PropHeader>Color Prop</PropHeader>
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
            <PropHeader>Solid Prop</PropHeader>
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
            <PropHeader>Directionality Prop</PropHeader>
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
            <PropHeader>Size Prop</PropHeader>
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
        </Section>
        <h4>Icon Set</h4>
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

const Section = styled('div')`
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  align-content: start;
  grid-gap: 16px;
  margin-bottom: 32px;
`;

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

const Examples = styled('div')`
  border: 1px solid ${p => p.theme.gray1};
  padding: 16px 24px;
`;

const PropHeader = styled('h5')`
  margin-bottom: 8px;
`;
