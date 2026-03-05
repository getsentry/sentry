import type React from 'react';
import isPropValid from '@emotion/is-prop-valid';
import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';

// eslint-disable-next-line no-relative-import-paths/no-relative-import-paths
import {baseAvatarStyles, type BaseAvatarStyleProps} from '../avatarComponentStyles';

export interface LetterAvatarProps
  extends React.HTMLAttributes<SVGSVGElement>, BaseAvatarStyleProps {
  configuration: {
    background: string & {__avatar: boolean};
    content: string & {__avatar: boolean};
    initials: string & {__avatar: boolean};
  };
  ref?: React.Ref<SVGSVGElement>;
}

export function LetterAvatar({configuration, ...props}: LetterAvatarProps) {
  const theme = useTheme();
  return (
    <LetterAvatarComponent viewBox="0 0 120 120" {...props}>
      <rect
        x="0"
        y="0"
        width="120"
        height="120"
        fill={
          props.suggested ? theme.tokens.background.primary : configuration.background
        }
      />
      <text
        x="50%"
        y="50%"
        fontSize="65"
        fontWeight="bold"
        style={{dominantBaseline: 'central'}}
        textAnchor="middle"
        fill={props.suggested ? theme.tokens.content.secondary : configuration.content}
      >
        {configuration.initials}
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
