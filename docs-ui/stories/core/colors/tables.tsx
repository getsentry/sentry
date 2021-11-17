import {useContext} from 'react';
import styled from '@emotion/styled';
import Sample, {SampleThemeContext} from 'docs-ui/components/sample';

import space from 'app/styles/space';

import ColorSwatch from './colorSwatch';

type ColorDefinition = {
  name: string;
  lightValue: string;
  darkValue: string;
};

type ColorGroup = {
  id: string;
  colors: ColorDefinition[];
};

const Wrap = styled('div')`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(16em, 1fr));
  grid-gap: ${space(2)};

  & > * {
    grid-column-end: span 1;
  }
`;

const ColorTable = ({colorGroups}: {colorGroups: ColorGroup[]}) => {
  const theme = useContext(SampleThemeContext);

  return (
    <Wrap>
      {colorGroups.map(group => {
        return <ColorSwatch key={group.id} colors={group.colors} theme={theme} />;
      })}
    </Wrap>
  );
};

const neutralColors: ColorGroup[] = [
  {
    id: 'gray500',
    colors: [
      {
        name: 'Gray 500',
        lightValue: '#2B2233',
        darkValue: '#EBE6EF',
      },
    ],
  },
  {
    id: 'gray400',
    colors: [
      {
        name: 'Gray 400',
        lightValue: '#4D4158',
        darkValue: '#D6D0DC',
      },
    ],
  },
  {
    id: 'gray300',
    colors: [
      {
        name: 'Gray 300',
        lightValue: '#80708F',
        darkValue: '#998DA5',
      },
    ],
  },
  {
    id: 'gray200',
    colors: [
      {
        name: 'Gray 200',
        lightValue: '#DBD6E1',
        darkValue: '#43384C',
      },
    ],
  },
  {
    id: 'gray100',
    colors: [
      {
        name: 'Gray 100',
        lightValue: '#EBE6EF',
        darkValue: '#342B3B',
      },
    ],
  },
];

const accentColors: ColorGroup[] = [
  {
    id: 'purple',
    colors: [
      {
        name: 'Purple 400',
        lightValue: '#584AC0',
        darkValue: '#6859CF',
      },
      {
        name: 'Purple 300',
        lightValue: '#6C5FC7',
        darkValue: '#7669D3',
      },
      {
        name: 'Purple 200',
        lightValue: 'rgba(108, 95, 199, 0.5)',
        darkValue: 'rgba(118, 105, 211, 0.6)',
      },
      {
        name: 'Purple 100',
        lightValue: 'rgba(108, 95, 199, 0.1)',
        darkValue: 'rgba(118, 105, 211, 0.1)',
      },
    ],
  },
  {
    id: 'blue',
    colors: [
      {
        name: 'Blue 400',
        lightValue: '#2562D4',
        darkValue: '#4284FF',
      },
      {
        name: 'Blue 300',
        lightValue: '#3C74DD',
        darkValue: '#5C95FF',
      },
      {
        name: 'Blue 200',
        lightValue: 'rgba(61, 116, 219, 0.5)',
        darkValue: 'rgba(92, 149, 255, 0.4)',
      },
      {
        name: 'Blue 100',
        lightValue: 'rgba(61, 116, 219, 0.09)',
        darkValue: 'rgba(92, 149, 255, 0.1)',
      },
    ],
  },
  {
    id: 'green',
    colors: [
      {
        name: 'Green 400',
        lightValue: '#268D75',
        darkValue: '#26B593',
      },
      {
        name: 'Green 300',
        lightValue: '#2BA185',
        darkValue: '#2AC8A3',
      },
      {
        name: 'Green 200',
        lightValue: 'rgba(43, 161, 133, 0.55)',
        darkValue: 'rgba(42, 200, 163, 0.4)',
      },
      {
        name: 'Green 100',
        lightValue: 'rgba(43, 161, 133, 0.13)',
        darkValue: 'rgba(42, 200, 163, 0.1)',
      },
    ],
  },
  {
    id: 'yellow',
    colors: [
      {
        name: 'Yellow 400',
        lightValue: '#E5A500',
        darkValue: '#F5B000',
      },
      {
        name: 'Yellow 300',
        lightValue: '#F5B000',
        darkValue: '#FFC227',
      },
      {
        name: 'Yellow 200',
        lightValue: 'rgba(245, 176, 0, 0.55)',
        darkValue: 'rgba(255, 194, 39, 0.35)',
      },
      {
        name: 'Yellow 100',
        lightValue: 'rgba(245, 176, 0, 0.08)',
        darkValue: 'rgba(255, 194, 39, 0.07)',
      },
    ],
  },
  {
    id: 'red',
    colors: [
      {
        name: 'Red 400',
        lightValue: '#F32F35',
        darkValue: '#FA2E34',
      },
      {
        name: 'Red 300',
        lightValue: '#F55459',
        darkValue: '#FA4F54',
      },
      {
        name: 'Red 200',
        lightValue: 'rgba(245, 84, 89, 0.5)',
        darkValue: 'rgba(250, 79, 84, 0.4)',
      },
      {
        name: 'Red 100',
        lightValue: 'rgba(245, 84, 89, 0.09)',
        darkValue: 'rgba(250, 79, 84, 0.1)',
      },
    ],
  },
  {
    id: 'Pink',
    colors: [
      {
        name: 'Pink 400',
        lightValue: '#E50675',
        darkValue: '#EF067A',
      },
      {
        name: 'Pink 300',
        lightValue: '#FA2991',
        darkValue: '#FA3396',
      },
      {
        name: 'Pink 200',
        lightValue: 'rgba(250, 41, 145, 0.5)',
        darkValue: 'rgba(250, 51, 150, 0.55)',
      },
      {
        name: 'Pink 100',
        lightValue: 'rgba(250, 41, 145, 0.1)',
        darkValue: 'rgba(250, 51, 150, 0.13)',
      },
    ],
  },
];

export const NeutralTable = () => (
  <Sample showThemeSwitcher>
    <ColorTable colorGroups={neutralColors} />
  </Sample>
);
export const AccentTable = () => (
  <Sample showThemeSwitcher>
    <ColorTable colorGroups={accentColors} />
  </Sample>
);
