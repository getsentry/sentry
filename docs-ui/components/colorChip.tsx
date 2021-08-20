import styled from '@emotion/styled';
import {withTheme} from '@emotion/react';
import Color from 'color';
import {Component} from 'react';

import {Theme} from 'app/utils/theme';

type Props = {
  // value is either a CSS color string (e.g. #000)
  // or a key in the theme object (e.g. 'blue300')
  value?: string;
  large: boolean;
  noText: boolean;
  // to replace the color name with a custom name
  textOverwrite?: string;
  theme: Theme;
};

const ColorChip = ({
  value,
  large = false,
  noText = false,
  textOverwrite,
  theme,
}: Props) => {
  let color;
  let colorString;

  if (theme[value]) {
    color = Color(theme[value]);
    colorString = value.split(/(\d+)/).join(' ');
  } else {
    color = Color(value);
    colorString = color && color.hex();
  }

  return (
    <OuterWrap large={large}>
      <Wrapper large={large} noText={noText}>
        <ColorSwatch
          large={large}
          background={color && color.hex()}
          border={color && color.luminosity() > 0.8}
        />
        {!noText && <Text large={large}>{textOverwrite || colorString}</Text>}
      </Wrapper>
    </OuterWrap>
  );
};

export default withTheme(ColorChip);

const OuterWrap = styled('span')`
  align-items: center;
  ${p =>
    p.large
      ? `
    display: flex;
    margin: 16px auto;
    `
      : `
    display: inline-flex;
    height: 1em;
    `}
`;

const Wrapper = styled('span')`
  display: flex;
  align-items: center;
  border-radius: ${p => p.theme.borderRadius};
  ${p => !p.noText && `border: solid 1px ${p.theme.gray100};`}
  ${p =>
    p.large
      ? `
          flex-direction: column;
          ${!p.noText && 'padding: 0.25em'}
        `
      : `
          transform: translateY(0.25em);
          ${!p.noText && 'padding: 2px 0.25em 2px 2px;'}
        `};
`;

const Text = styled('span')`
  margin-bottom: 0;
  line-height: 1.2;
  text-transform: capitalize;
  ${p => (p.large ? `margin-top: 0.25em;` : `margin-left: 0.25em;`)}
`;

const ColorSwatch = styled('span')`
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
