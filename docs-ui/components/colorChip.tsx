import {withTheme} from '@emotion/react';
import styled from '@emotion/styled';
import Color from 'color';

import space from 'app/styles/space';
import {Theme} from 'app/utils/theme';

type Props = {
  /**
   * value is either a CSS color string (e.g. #000)
   * or a key in the theme object (e.g. 'blue300')
   */
  value: string | keyof Theme;
  large?: boolean;
  noText?: boolean;
  /**
   * to replace the parsed color name with a custom name
   */
  textOverwrite?: string;
  theme: Theme;
};

type OuterWrapProps = {
  large: boolean;
};

type WrapperProps = {
  large: boolean;
  noText: boolean;
};

type ColorSwatchProps = {
  large: boolean;
  background: string;
  border: boolean;
};

type TextProps = {
  large: boolean;
};

const ColorChip = ({
  value,
  large = false,
  noText = false,
  textOverwrite,
  theme,
}: Props) => {
  const isThemeColor = value in theme;

  const color = Color(isThemeColor ? theme[value] : value);
  const colorString = isThemeColor
    ? value.split(/(\d+)/).join(' ').trim()
    : color?.hex?.();

  return (
    <OuterWrap large={large}>
      <Wrapper large={large} noText={noText}>
        <ColorSwatch
          large={large}
          background={color?.hex?.()}
          border={color?.luminosity?.() > 0.8}
        />
        {!noText && <Text large={large}>{textOverwrite ?? colorString}</Text>}
      </Wrapper>
    </OuterWrap>
  );
};

export default withTheme(ColorChip);

const OuterWrap = styled('span')<OuterWrapProps>`
  align-items: center;
  ${p =>
    p.large
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
  ${p => !p.noText && `border: solid 1px ${p.theme.gray100};`}
  ${p =>
    p.large
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

const Text = styled('span')<TextProps>`
  margin-bottom: 0;
  line-height: 1.2;
  text-transform: capitalize;
  ${p => (p.large ? `margin-top: ${space(0.5)};` : `margin-left: ${space(0.5)};`)}
`;

const ColorSwatch = styled('span')<ColorSwatchProps>`
  display: inline;
  border-radius: ${p => p.theme.borderRadius};
  background-color: ${p => p.background};
  ${p => p.border && `border: solid 1px ${p.theme.gray100};`}
  ${p =>
    p.large
      ? `
          width: 4.5em;
          height: 4.5em;
        `
      : `
          width: 1.2em;
          height: 1.2em;
        `};
`;
