import React from 'react';
import {withInfo} from '@storybook/addon-info';
import styled from '@emotion/styled';

import {IconAdd, IconArrow, IconBookmark, IconGroup, IconPin} from 'app/icons';

export default {
  title: 'Style/Icons',
};

export const IconProps = withInfo('Props you can assign to the icon components')(() => {
  return (
    <SwatchWrapper>
      <ColorSwatches>
        <Header>Color Prop</Header>
        <Swatch>
          <IconBookmark />
          <LabelWrapper>IconBookmark</LabelWrapper>
        </Swatch>
        <Swatch>
          <IconBookmark isSolid color="#6C5FC7" />
          <LabelWrapper>
            IconBookmark <Highlight>solid color="#6C5FC7"</Highlight>
          </LabelWrapper>
        </Swatch>
      </ColorSwatches>
      <SizeSwatches>
        <Header>Size Prop</Header>
        <Swatch>
          <IconGroup size="xs" />
          <LabelWrapper>
            IconGroup <Highlight>size="xs"</Highlight>
          </LabelWrapper>
        </Swatch>
        <Swatch>
          <IconGroup />
          <LabelWrapper>IconGroup</LabelWrapper>
        </Swatch>
        <Swatch>
          <IconGroup size="md" />
          <LabelWrapper>
            IconGroup <Highlight>size="md"</Highlight>
          </LabelWrapper>
        </Swatch>
        <Swatch>
          <IconGroup size="lg" />
          <LabelWrapper>
            IconGroup <Highlight>size="lg"</Highlight>
          </LabelWrapper>
        </Swatch>
        <Swatch>
          <IconGroup size="xl" />
          <LabelWrapper>
            IconGroup <Highlight>size="xl"</Highlight>
          </LabelWrapper>
        </Swatch>
      </SizeSwatches>
      <DirectionSwatches>
        <Header>Direction Prop</Header>
        <Swatch>
          <IconArrow />
          <LabelWrapper>IconArrow</LabelWrapper>
        </Swatch>
        <Swatch>
          <IconArrow direction="left" />
          <LabelWrapper>
            IconArrow <Highlight>direction="left"</Highlight>
          </LabelWrapper>
        </Swatch>
        <Swatch>
          <IconArrow direction="down" />
          <LabelWrapper>
            IconArrow <Highlight>direction="down"</Highlight>
          </LabelWrapper>
        </Swatch>
        <Swatch>
          <IconArrow direction="right" />
          <LabelWrapper>
            IconArrow <Highlight>direction="right"</Highlight>
          </LabelWrapper>
        </Swatch>
      </DirectionSwatches>
      <CircleSwatches>
        <Header>Circle Prop</Header>
        <Swatch>
          <IconAdd />
          <LabelWrapper>IconAdd</LabelWrapper>
        </Swatch>
        <Swatch>
          <IconAdd circle />
          <LabelWrapper>
            IconAdd <Highlight>circle</Highlight>
          </LabelWrapper>
        </Swatch>
      </CircleSwatches>
      <SolidSwatches>
        <Header>Solid Prop</Header>
        <Swatch>
          <IconPin />
          <LabelWrapper>IconPin</LabelWrapper>
        </Swatch>
        <Swatch>
          <IconPin solid />
          <LabelWrapper>
            IconPin <Highlight>solid</Highlight>
          </LabelWrapper>
        </Swatch>
      </SolidSwatches>
    </SwatchWrapper>
  );
});

const Highlight = styled('span')`
  color: ${p => p.theme.purple400};
  font-weight: 600;
`;

const Header = styled('h5')`
  margin-bottom: 8px;
`;

const LabelWrapper = styled('div')`
  font-size: 14px;
  margin-left: 16px;
`;

const SwatchWrapper = styled('div')`
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  grid-template-rows: repeat(5, auto);
  grid-gap: 16px;
`;

const Swatches = styled('div')`
  border: 1px solid ${p => p.theme.borderLight};
  padding: 24px;
`;

const ColorSwatches = styled(Swatches)`
  grid-column: 1/2;
  grid-row: 1/2;
`;

const SizeSwatches = styled(Swatches)`
  grid-column: 1/2;
  grid-row: 2/6;
`;

const DirectionSwatches = styled(Swatches)`
  grid-column: 2/3;
  grid-row: 1/4;
`;

const CircleSwatches = styled(Swatches)`
  grid-column: 2/3;
`;

const SolidSwatches = styled(Swatches)`
  grid-column: 2/3;
`;

const Swatch = styled('div')`
  display: flex;
  align-items: center;
  min-height: 32px;

  svg {
    min-width: 32px;
  }
`;
