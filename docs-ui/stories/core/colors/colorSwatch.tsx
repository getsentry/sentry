import styled from '@emotion/styled';
import * as Color from 'color';

import space from 'app/styles/space';

type Props = {
  theme: 'light' | 'dark';
  colors: [
    {
      name: string;
      darkValue: string;
      lightValue: string;
    }
  ];
};

const ColorSwatch = ({colors, theme}: Props) => {
  return (
    <Wrap>
      {colors.map(color => {
        const colorValue = theme === 'light' ? color.lightValue : color.darkValue;
        let labelColor = 'gray500';
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
          <ColorWrap key={color.name} value={colorValue}>
            <ColorName color={labelColor}>{color.name}</ColorName>
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
`;

const ColorValue = styled(Label)`
  opacity: 0.8;
`;
