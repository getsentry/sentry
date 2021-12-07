import styled from '@emotion/styled';
import Color from 'color';

import space from 'sentry/styles/space';
// eslint-disable-next-line no-restricted-imports
import {darkColors, lightColors} from 'sentry/utils/theme';

type Props = {
  theme: 'light' | 'dark';
  colors: Array<keyof typeof lightColors>;
};

const ColorSwatch = ({colors, theme}: Props) => {
  return (
    <Wrap>
      {colors.map(color => {
        /**
         * Get color name from color key,
         * e.g. 'gray500' becomes 'gray 500'
         */
        const colorName = color.replace(/(\D+)(\d+)/, '$1 $2');
        const colorValue = theme === 'light' ? lightColors[color] : darkColors[color];
        let labelColor = 'black';
        /**
         * Use a white label if the color is dark or if
         * the background is dark and the color is semi-transparent
         */
        if (
          (Color(colorValue).alpha() > 0.5 && Color(colorValue).isDark()) ||
          (Color(colorValue).alpha() <= 0.5 && theme === 'dark')
        ) {
          labelColor = 'white';
        }

        return (
          <ColorWrap key={color} value={colorValue}>
            <ColorName color={labelColor}>{colorName}</ColorName>
            <ColorValue color={labelColor}>{colorValue}</ColorValue>
          </ColorWrap>
        );
      })}
    </Wrap>
  );
};

export default ColorSwatch;

const Wrap = styled('div')`
  border-radius: ${p => p.theme.borderRadius};
  overflow: hidden;
`;

const ColorWrap = styled('div')<{value: string}>`
  background: ${p => p.value};
  padding: ${space(2)} ${space(2)};
`;

const Label = styled('p')<{color: boolean}>`
  margin-bottom: 0;
  white-space: nowrap;
  && {
    color: ${p => p.theme[p.color]};
  }
`;

const ColorName = styled(Label)`
  font-weight: bold;
  text-transform: capitalize;
  opacity: 0.95;
`;

const ColorValue = styled(Label)`
  opacity: 0.8;
`;
