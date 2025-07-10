import type React from 'react';
import type {DO_NOT_USE_ChonkTheme} from '@emotion/react';
import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';

import {isChonkTheme} from 'sentry/utils/theme/withChonk';

import {type BaseAvatarStyleProps, baseAvatarStyles} from './baseAvatarComponentStyles';

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
  const theme = useTheme();
  return (
    <LetterAvatarComponent ref={ref} viewBox="0 0 120 120" {...props}>
      <rect x="0" y="0" width="120" height="120" rx="15" ry="15" />
      <text
        x="50%"
        y="50%"
        fontSize="65"
        fontWeight={theme.isChonk ? 'bold' : 'inherit'}
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
      isChonkTheme(props.theme)
        ? props.suggested
          ? props.theme.background
          : getChonkColor(props.identifier, props.theme).background
        : props.suggested
          ? props.theme.background
          : getColor(props.identifier)};
  }

  text {
    fill: ${props =>
      isChonkTheme(props.theme)
        ? props.suggested
          ? props.theme.subText
          : getChonkColor(props.identifier, props.theme).content
        : props.suggested
          ? props.theme.subText
          : props.theme.white};
  }
`;

const COLORS = [
  '#4674ca', // blue
  '#315cac', // blue_dark
  '#57be8c', // green
  '#3fa372', // green_dark
  '#f9a66d', // yellow_orange
  '#ec5e44', // red
  '#e63717', // red_dark
  '#f868bc', // pink
  '#6c5fc7', // purple
  '#4e3fb4', // purple_dark
  '#57b1be', // teal
  '#847a8c', // gray
] as const;

type Color = (typeof COLORS)[number];

function hashIdentifier(identifier: string) {
  identifier += '';
  let hash = 0;
  for (let i = 0; i < identifier.length; i++) {
    hash += identifier.charCodeAt(i);
  }
  return hash;
}

function getColor(identifier: string | undefined): Color {
  // Gray if the identifier is not set
  if (identifier === undefined) {
    return '#847a8c';
  }

  const id = hashIdentifier(identifier);
  return COLORS[id % COLORS.length]!;
}

function getChonkColor(
  identifier: string | undefined,
  theme: DO_NOT_USE_ChonkTheme
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

function makeChonkLetterAvatarColors(theme: DO_NOT_USE_ChonkTheme): Array<{
  background: string;
  content: string;
}> {
  return [
    {
      background: theme.colors.chonk.blue400,
      content: theme.colors.white,
    },
    {
      background: theme.colors.chonk.pink400,
      content: theme.colors.black,
    },
    {
      background: theme.colors.chonk.red400,
      content: theme.colors.white,
    },
    {
      background: theme.colors.chonk.yellow400,
      content: theme.colors.black,
    },
    {
      background: theme.colors.chonk.green400,
      content: theme.colors.black,
    },
  ];
}
