import styled from '@emotion/styled';
import type {DistributedOmit} from 'type-fest';

import {Avatar, type BaseAvatarProps} from '@sentry/scraps/avatar';

import {Button, type ButtonProps} from './button';

export interface AvatarButtonProps extends Omit<ButtonProps, 'children' | 'icon'> {
  'aria-label': string;
  avatar: DistributedOmit<BaseAvatarProps, 'round' | 'size'>;
  size?: Exclude<ButtonProps['size'], 'zero'>;
}

export function AvatarButton({avatar, ...props}: AvatarButtonProps) {
  return (
    <StyledAvatarButton {...props}>
      <StyledAvatar {...avatar} round={false} />
    </StyledAvatarButton>
  );
}

const StyledAvatar = styled(Avatar)`
  width: 100%;
  height: 100%;
`;

const StyledAvatarButton = styled(Button)`
  padding: 0;
  width: ${p => (p.size === 'zero' ? '24px' : p.theme.form[p.size ?? 'md'].height)};
  min-width: ${p => (p.size === 'zero' ? '24px' : p.theme.form[p.size ?? 'md'].height)};
`;
