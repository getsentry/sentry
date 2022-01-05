import {useContext} from 'react';
import styled from '@emotion/styled';
import Sample, {SampleThemeContext} from 'docs-ui/components/sample';

import space from 'sentry/styles/space';
// eslint-disable-next-line no-restricted-imports
import {lightColors} from 'sentry/utils/theme';

import ColorSwatch from './colorSwatch';

type ColorGroup = {
  id: string;
  colors: Array<keyof typeof lightColors>;
};

const Wrap = styled('div')`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(16em, 1fr));
  gap: ${space(2)};

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
    colors: ['gray500'],
  },
  {
    id: 'gray400',
    colors: ['gray400'],
  },
  {
    id: 'gray300',
    colors: ['gray300'],
  },
  {
    id: 'gray200',
    colors: ['gray200'],
  },
  {
    id: 'gray100',
    colors: ['gray100'],
  },
];

const accentColors: ColorGroup[] = [
  {
    id: 'purple',
    colors: ['purple400', 'purple300', 'purple200', 'purple100'],
  },
  {
    id: 'blue',
    colors: ['blue400', 'blue300', 'blue200', 'blue100'],
  },
  {
    id: 'green',
    colors: ['green400', 'green300', 'green200', 'green100'],
  },
  {
    id: 'yellow',
    colors: ['yellow400', 'yellow300', 'yellow200', 'yellow100'],
  },
  {
    id: 'red',
    colors: ['red400', 'red300', 'red200', 'red100'],
  },
  {
    id: 'Pink',
    colors: ['pink400', 'pink300', 'pink200', 'pink100'],
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
