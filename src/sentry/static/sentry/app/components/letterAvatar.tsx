import PropTypes from 'prop-types';
import * as React from 'react';
import styled from '@emotion/styled';

import {imageStyle} from 'app/components/avatar/styles';

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

type Color = typeof COLORS[number];

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
  return COLORS[id % COLORS.length];
}

function getInitials(displayName: string | undefined) {
  const names = ((displayName && displayName.trim()) || '?').split(' ');
  // Use Array.from as slicing and substring() work on ucs2 segments which
  // results in only getting half of any 4+ byte character.
  let initials = Array.from(names[0])[0];
  if (names.length > 1) {
    initials += Array.from(names[names.length - 1])[0];
  }
  return initials.toUpperCase();
}

type Props = {
  identifier?: string;
  displayName?: string;
  round?: boolean;
  forwardedRef?: React.Ref<SVGSVGElement>;
};

type LetterAvatarProps = React.ComponentProps<'svg'> & Props;

/**
 * Also see avatar.py. Anything changed in this file (how colors are selected,
 * the svg, etc) will also need to be changed there.
 */
const LetterAvatar = styled(
  ({
    identifier,
    displayName,
    round: _round,
    forwardedRef,
    ...props
  }: LetterAvatarProps) => (
    <svg ref={forwardedRef} viewBox="0 0 120 120" {...props}>
      <rect
        x="0"
        y="0"
        width="120"
        height="120"
        rx="15"
        ry="15"
        fill={getColor(identifier)}
      />
      <text
        x="50%"
        y="50%"
        fontSize="65"
        style={{dominantBaseline: 'central'}}
        textAnchor="middle"
        fill="#FFFFFF"
      >
        {getInitials(displayName)}
      </text>
    </svg>
  )
)<Props>`
  ${imageStyle};
`;

LetterAvatar.propTypes = {
  identifier: PropTypes.string,
  displayName: PropTypes.string,
  round: PropTypes.bool,
};

LetterAvatar.defaultProps = {
  round: false,
};

export default React.forwardRef<SVGSVGElement, Props>((props, ref) => (
  <LetterAvatar forwardedRef={ref} {...props} />
));
