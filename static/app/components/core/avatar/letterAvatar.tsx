import type React from 'react';
import styled from '@emotion/styled';
import color from 'color';

import type {Theme} from 'sentry/utils/theme';

import {baseAvatarStyles, type BaseAvatarStyleProps} from './baseAvatarComponentStyles';

interface LetterAvatarProps
  extends React.HTMLAttributes<SVGSVGElement>,
    BaseAvatarStyleProps {
  identifier: string | undefined;
  displayName?: string;
  ref?: React.Ref<SVGSVGElement>;
}

/**
 * Also see avatar.py. Anything changed in this file (how colors are selected,
 * the svg, etc) will also need to be changed there.
 */
export function LetterAvatar({displayName, ref, ...props}: LetterAvatarProps) {
  return (
    <LetterAvatarComponent ref={ref} viewBox="0 0 120 120" {...props}>
      <rect x="0" y="0" width="120" height="120" rx="15" ry="15" />
      <text
        x="50%"
        y="50%"
        fontSize="65"
        fontWeight="bold"
        style={{dominantBaseline: 'central'}}
        textAnchor="middle"
      >
        {getInitials(displayName)}
      </text>
    </LetterAvatarComponent>
  );
}

const LetterAvatarComponent = styled('svg')<LetterAvatarProps>`
  ${baseAvatarStyles};

  rect {
    fill: ${props =>
      props.suggested
        ? props.theme.tokens.background.primary
        : getChonkColor(props.identifier, props.theme).background};
  }

  text {
    fill: ${props =>
      props.suggested
        ? props.theme.subText
        : getChonkColor(props.identifier, props.theme).content};
  }
`;

function hashIdentifier(identifier: string) {
  identifier += '';
  let hash = 0;
  for (let i = 0; i < identifier.length; i++) {
    hash += identifier.charCodeAt(i);
  }
  return hash;
}

function getChonkColor(
  identifier: string | undefined,
  theme: Theme
): {
  background: string;
  content: string;
} {
  const colors = makeChonkLetterAvatarColors(theme);
  if (identifier === undefined) {
    return colors[0]!;
  }

  const id = hashIdentifier(identifier);
  return colors[id % colors.length]!;
}

function getInitials(displayName: string | undefined) {
  const names = ((typeof displayName === 'string' && displayName.trim()) || '?').split(
    ' '
  );

  // Use Array.from as slicing and substring() work on ucs2 segments which
  // results in only getting half of any 4+ byte character.
  let initials = Array.from(names[0]!)[0]!;
  if (names.length > 1) {
    initials += Array.from(names[names.length - 1]!)[0]!;
  }
  return initials.toUpperCase();
}

function makeChonkLetterAvatarColors(theme: Theme) {
  return theme.chart.getColorPalette(9).map(c => ({
    background: c,
    content: color(c).isDark() ? theme.colors.white : theme.colors.black,
  }));
}
