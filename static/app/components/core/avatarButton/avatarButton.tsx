import {css} from '@emotion/react';
import styled from '@emotion/styled';
import type {DistributedOmit} from 'type-fest';

import type {BaseAvatarProps} from '@sentry/scraps/avatar';
import {ImageAvatar, LetterAvatar, useAvatar} from '@sentry/scraps/avatar';
import {Button, type ButtonProps} from '@sentry/scraps/button';
import {Container, type Responsive, useResponsivePropValue} from '@sentry/scraps/layout';
import {useSizeContext} from '@sentry/scraps/sizeContext';

import {useAvatarColors} from './useAvatarColors';

type AvatarButtonSize = 'xs' | 'sm' | 'md';

interface AvatarButtonProps extends Omit<ButtonProps, 'children' | 'icon' | 'variant'> {
  'aria-label': string;
  avatar: BaseAvatarProps;
  size?: Responsive<AvatarButtonSize>;
}

export function AvatarButton({avatar, size: explicitSize, ...props}: AvatarButtonProps) {
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

  const colors = useAvatarColors(avatar);

  const contextSize = useSizeContext();
  const size = useResponsivePropValue(explicitSize ?? contextSize ?? 'md');

  if (avatarDefinition.type === 'letter') {
    const chonk = colors.type === 'letter' ? colors.chonk : undefined;
    return (
      <StyledAvatarButton {...props} size={size} chonk={chonk}>
        <AvatarContainer size={size} chonk={chonk}>
          <StyledLetterAvatar configuration={avatarDefinition.configuration} />
        </AvatarContainer>
      </StyledAvatarButton>
    );
  }

  const chonk = colors.type === 'image' ? colors.chonk : undefined;
  const padded = colors.type === 'image' ? colors.style === 'padded' : false;

  return (
    <StyledAvatarButton {...props} size={size} chonk={chonk}>
      <AvatarContainer size={size} padded={padded} chonk={chonk}>
        <StyledImageAvatar configuration={avatarDefinition.configuration} />
      </AvatarContainer>
    </StyledAvatarButton>
  );
}

const RADIUS_BY_SIZE: Record<AvatarButtonSize, 'sm' | 'md' | 'lg'> = {
  xs: 'sm',
  sm: 'md',
  md: 'lg',
};

function AvatarContainer({
  children,
  chonk,
  padded = false,
  size,
}: {
  children: React.ReactNode;
  size: AvatarButtonSize;
  chonk?: string;
  padded?: boolean;
}) {
  return (
    <StyledAvatarContainer
      width="100%"
      height="100%"
      overflow="hidden"
      border="primary"
      radius={RADIUS_BY_SIZE[size]}
      padding={padded ? 'xs' : '0'}
      background={padded ? 'primary' : undefined}
      position="relative"
      chonk={chonk}
    >
      {children}
    </StyledAvatarContainer>
  );
}

// ponytail: styled(Container) only for dynamic borderColor — Container's
// border prop handles the 1px solid, we just override the color.
const StyledAvatarContainer = styled(Container)<{chonk?: string}>`
  border-color: ${p => p.chonk ?? 'transparent'};
  will-change: transform;
`;

const StyledImageAvatar = styled(ImageAvatar)`
  width: 100%;
  height: 100%;
  border-radius: 0;
  position: relative;
  object-fit: contain;
`;

const StyledLetterAvatar = styled(LetterAvatar)`
  width: 100%;
  height: 100%;
  border-radius: 0;
  position: relative;
`;

// Elevation per size, matching the base button's chonk depth.
const AVATAR_BUTTON_ELEVATION: Record<AvatarButtonSize, string> = {
  md: '2px',
  sm: '2px',
  xs: '1px',
};

type ResolvedAvatarButtonProps = DistributedOmit<ButtonProps, 'size'> & {
  chonk: string | undefined;
  size: AvatarButtonSize;
};

function AvatarButtonBase({chonk: _chonk, ...props}: ResolvedAvatarButtonProps) {
  return <Button {...props} />;
}

const StyledAvatarButton = styled(AvatarButtonBase)`
  padding: 0;
  width: ${p => p.theme.form[p.size].height};
  min-width: ${p => p.theme.form[p.size].height};

  ${p =>
    p.chonk &&
    css`
      &&::before {
        background: ${p.chonk};
        box-shadow: 0 ${AVATAR_BUTTON_ELEVATION[p.size]} 0 0px ${p.chonk};
      }
      &&::after {
        border-color: ${p.chonk};
      }
    `}
`;
