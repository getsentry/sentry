import styled from '@emotion/styled';

import type {BaseAvatarProps} from '@sentry/scraps/avatar';
import {ImageAvatar, LetterAvatar, useAvatar} from '@sentry/scraps/avatar';
import {Button, type ButtonProps} from '@sentry/scraps/button';

interface AvatarButtonProps extends Omit<ButtonProps, 'children' | 'icon' | 'priority'> {
  'aria-label': string;
  avatar: BaseAvatarProps;
  size?: Exclude<ButtonProps['size'], 'zero'>;
}

export function AvatarButton({avatar, size, ...props}: AvatarButtonProps) {
  const avatarDefinition = useAvatar({
    identifier: avatar.identifier,
    name: avatar.name,
    imageDefinition:
      avatar.type === 'upload'
        ? {type: 'upload', uploadUrl: avatar.uploadUrl}
        : avatar.type === 'gravatar'
          ? {type: 'gravatar', gravatarId: avatar.gravatarId}
          : undefined,
  });

  return (
    <StyledAvatarButton size={size ?? 'md'} {...props}>
      <AvatarContainer size={size ?? 'md'}>
        {avatarDefinition.type === 'image' ? (
          <StyledImageAvatar
            src={avatarDefinition.src}
            ref={avatarDefinition.ref}
            alt={avatar.name}
          />
        ) : (
          <StyledLetterAvatar
            initials={avatarDefinition.initials}
            avatarColor={avatarDefinition.avatarColor}
          />
        )}
      </AvatarContainer>
    </StyledAvatarButton>
  );
}

const AvatarContainer = styled('div')<{size: ButtonProps['size']}>`
  width: 100%;
  height: 100%;
  overflow: hidden;
  border: 1px solid transparent;
  border-radius: ${p =>
    p.size === 'md'
      ? p.theme.radius.lg
      : p.size === 'sm'
        ? p.theme.radius.md
        : p.size === 'xs'
          ? p.theme.radius.sm
          : p.theme.radius.xs};
`;

const StyledImageAvatar = styled(ImageAvatar)`
  width: 100%;
  height: 100%;
  border-radius: 0;
  position: relative;
`;
const StyledLetterAvatar = styled(LetterAvatar)`
  width: 100%;
  height: 100%;
  border-radius: 0;
  position: relative;
`;

const StyledAvatarButton = styled(Button)`
  padding: 0;
  width: ${p => (p.size === 'zero' ? '24px' : p.theme.form[p.size ?? 'md'].height)};
  min-width: ${p => (p.size === 'zero' ? '24px' : p.theme.form[p.size ?? 'md'].height)};
`;
