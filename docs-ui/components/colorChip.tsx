import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';
import Color from 'color';

import space from 'sentry/styles/space';
import {Theme} from 'sentry/utils/theme';

type SizeProp = {
  size: 'md' | 'lg';
};

type Props = SizeProp & {
  /**
   * value is either a CSS color string (e.g. #000)
   * or a key in the theme object (e.g. 'blue300')
   */
  value: string | keyof Theme;
  noText?: boolean;
  /**
   * to replace the parsed color name with a custom name
   */
  textOverwrite?: string;
};

type WrapperProps = SizeProp & {
  noText: boolean;
};

type ColorSwatchProps = SizeProp & {
  background: string;
  border: boolean;
};

function ColorChip({value, size = 'md', noText = false, textOverwrite}: Props) {
  const theme = useTheme();

  const isThemeColor = value in theme;

  const color = Color(isThemeColor ? theme[value] : value);
  const colorString = isThemeColor
    ? value.split(/(\d+)/).join(' ').trim()
    : color?.hex?.();

  return (
    <OuterWrap size={size}>
      <Wrapper size={size} noText={noText}>
        <ColorSwatch
          size={size}
          background={color?.hex?.()}
          border={color?.luminosity?.() > 0.8}
        />
        {!noText && <Text size={size}>{textOverwrite ?? colorString}</Text>}
      </Wrapper>
    </OuterWrap>
  );
}

export default ColorChip;

const OuterWrap = styled('span')<SizeProp>`
  align-items: center;
  ${p =>
    p.size === 'lg'
      ? `
    display: flex;
    margin: ${space(2)} auto;
    `
      : `
    display: inline-flex;
    height: 1em;
    `}
`;

const Wrapper = styled('span')<WrapperProps>`
  display: flex;
  align-items: center;
  border-radius: ${p => p.theme.borderRadius};
  ${p => !p.noText && `border: solid 1px ${p.theme.border};`}
  ${p =>
    p.size === 'lg'
      ? `
          flex-direction: column;
          ${!p.noText && `padding: ${space(0.5)}`}
        `
      : `
          transform: translateY(0.25em);
          ${
            !p.noText &&
            `padding: ${space(0.25)} ${space(0.5)} ${space(0.25)} ${space(0.25)};`
          }
        `};
`;

const Text = styled('span')<SizeProp>`
  margin-bottom: 0;
  line-height: 1.2;
  text-transform: capitalize;
  ${p => (p.size === 'lg' ? `margin-top: ${space(0.5)};` : `margin-left: ${space(0.5)};`)}
`;

const ColorSwatch = styled('span')<ColorSwatchProps>`
  display: inline;
  border-radius: ${p => p.theme.borderRadius};
  background-color: ${p => p.background};
  ${p => p.border && `border: solid 1px ${p.theme.border};`}
  ${p =>
    p.size === 'lg'
      ? `
          width: 4.5em;
          height: 4.5em;
        `
      : `
          width: 1.2em;
          height: 1.2em;
        `};
`;
