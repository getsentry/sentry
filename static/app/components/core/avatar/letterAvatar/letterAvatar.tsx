import type React from 'react';
import styled from '@emotion/styled';
import color from 'color';

import type {Theme} from 'sentry/utils/theme';

// eslint-disable-next-line no-relative-import-paths/no-relative-import-paths
import {baseAvatarStyles, type BaseAvatarStyleProps} from '../avatarComponentStyles';

/**
 * Note that avatars currently do not support refs. This is because they are only exposed
 * through the main Avatar component, which wraps the avatar in a container element, and has
 * histrically hijacked the ref and attached it to the container element, and we would need
 * to eliminate the wrapper before we can enable ref support.
 */
export interface LetterAvatarProps
  extends React.HTMLAttributes<SVGSVGElement>, BaseAvatarStyleProps {
  /**
   * Stable identifier used for color selection. Should not change over time.
   * Examples: email, username, user ID, team slug, organization slug
   */
  identifier: string;
  /**
   * Display name used for rendering initials.
   * Examples: user.name, team.name, organization.name
   */
  name: string;
}

/**
 * Also see avatar.py. Anything changed in this file (how colors are selected,
 * the svg, etc) will also need to be changed there.
 */
export function LetterAvatar(props: LetterAvatarProps) {
  return (
    <LetterAvatarComponent viewBox="0 0 120 120" {...props}>
      <rect x="0" y="0" width="120" height="120" rx="15" ry="15" />
      <text
        x="50%"
        y="50%"
        fontSize="65"
        fontWeight="bold"
        style={{dominantBaseline: 'central'}}
        textAnchor="middle"
      >
        {getInitials(props.name)}
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
        : getColor(props.identifier, props.theme).background};
  }

  text {
    fill: ${props =>
      props.suggested
        ? props.theme.tokens.content.secondary
        : getColor(props.identifier, props.theme).content};
  }
`;

/**
 * Generates a numeric hash from a string identifier for consistent color selection
 */
function hashIdentifier(identifier: string) {
  const str = String(identifier);
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash += str.charCodeAt(i);
  }
  return hash;
}

function getColor(
  identifier: string | undefined,
  theme: Theme
): {
  background: string;
  content: string;
} {
  const colors = makeLetterAvatarColors(theme);
  if (identifier === undefined) {
    return colors[0]!;
  }

  const id = hashIdentifier(identifier);
  return colors[id % colors.length]!;
}

function getInitials(name: string | undefined) {
  const sanitizedName = name?.trim();

  if (!sanitizedName) {
    return '?';
  }

  const words = sanitizedName.split(' ');

  // Use Array.from as slicing and substring() work on ucs2 segments which
  // results in only getting half of any 4+ byte character.
  let initials = Array.from(words[0]!)[0]!;
  if (words.length > 1) {
    initials += Array.from(words[words.length - 1]!)[0]!;
  }
  return initials.toUpperCase();
}

function makeLetterAvatarColors(theme: Theme) {
  return theme.chart.getColorPalette(9).map(c => ({
    background: c,
    content: color(c).isDark()
      ? theme.tokens.content.onVibrant.light
      : theme.tokens.content.onVibrant.dark,
  }));
}
