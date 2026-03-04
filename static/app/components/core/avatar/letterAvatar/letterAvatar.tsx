import type React from 'react';
import isPropValid from '@emotion/is-prop-valid';
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
  return (
    <LetterAvatarComponent
      viewBox="0 0 120 120"
      avatarColor={avatarColor}
      initials={initials}
      {...props}
    >
      <rect x="0" y="0" width="120" height="120" />
      <text
        x="50%"
        y="50%"
        fontSize="65"
        fontWeight="bold"
        style={{dominantBaseline: 'central'}}
        textAnchor="middle"
      >
        {initials}
      </text>
    </LetterAvatarComponent>
  );
}

const LetterAvatarComponent = styled('svg', {
  shouldForwardProp: prop =>
    isPropValid(prop) &&
    prop !== 'suggested' &&
    prop !== 'round' &&
    prop !== 'avatarColor' &&
    prop !== 'initials',
})<LetterAvatarProps>`
  ${baseAvatarStyles};

  rect {
    fill: ${props =>
      props.suggested
        ? // eslint-disable-next-line @sentry/scraps/use-semantic-token
          props.theme.tokens.background.primary
        : props.avatarColor.background};
  }

  text {
    fill: ${props =>
      props.suggested ? props.theme.tokens.content.secondary : props.avatarColor.content};
  }
`;
