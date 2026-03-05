import type React from 'react';
import isPropValid from '@emotion/is-prop-valid';
import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';

// eslint-disable-next-line no-relative-import-paths/no-relative-import-paths
import {baseAvatarStyles, type BaseAvatarStyleProps} from '../avatarComponentStyles';

interface LetterAvatarProps
  extends React.HTMLAttributes<SVGSVGElement>, BaseAvatarStyleProps {
  /**
   * Resolved color for the avatar background and text.
   * Compute this via useAvatar() or getColor() from useAvatar.tsx.
   * Named avatarColor to avoid conflict with HTMLAttributes<SVGSVGElement>["color"].
   */
  avatarColor: {background: string; content: string};
  /**
   * Initials to display inside the avatar.
   * Compute this via useAvatar() or getInitials() from useAvatar.tsx.
   */
  initials: string;
  ref?: React.Ref<SVGSVGElement>;
}

export function LetterAvatar({initials, avatarColor, ...props}: LetterAvatarProps) {
  const theme = useTheme();
  return (
    <LetterAvatarComponent viewBox="0 0 120 120" {...props}>
      <rect
        x="0"
        y="0"
        width="120"
        height="120"
        fill={props.suggested ? theme.tokens.background.primary : avatarColor.background}
      />
      <text
        x="50%"
        y="50%"
        fontSize="65"
        fontWeight="bold"
        style={{dominantBaseline: 'central'}}
        textAnchor="middle"
        fill={props.suggested ? theme.tokens.content.secondary : avatarColor.content}
      >
        {initials}
      </text>
    </LetterAvatarComponent>
  );
}

const LetterAvatarComponent = styled('svg', {
  shouldForwardProp: prop =>
    isPropValid(prop) && prop !== 'suggested' && prop !== 'round',
})<BaseAvatarStyleProps>`
  ${baseAvatarStyles};
`;
