import {useTheme, css} from '@emotion/react';
import styled from '@emotion/styled';
import type {DistributedOmit} from 'type-fest';

import type {BaseAvatarProps} from '@sentry/scraps/avatar';
import {ImageAvatar, LetterAvatar, useAvatar} from '@sentry/scraps/avatar';
import {Button, type ButtonProps} from '@sentry/scraps/button';
import {useSizeContext} from '@sentry/scraps/sizeContext';

import {IconUser} from 'sentry/icons';

import {useAvatarColors} from './useAvatarColors';

type AvatarButtonSize = 'xs' | 'sm' | 'md';

interface AvatarButtonProps extends Omit<ButtonProps, 'children' | 'icon' | 'variant'> {
  'aria-label': string;
  /** Omit to render an empty/unassigned placeholder. */
  avatar?: BaseAvatarProps;
  /** Circular (e.g. users) vs squircle (e.g. teams) shape. Defaults to `avatar.round`. */
  round?: boolean;
  size?: AvatarButtonSize;
}

export function AvatarButton({
  avatar,
  round: explicitRound,
  size: explicitSize,
  ...props
}: AvatarButtonProps) {
  const theme = useTheme();
  const round = explicitRound ?? avatar?.round ?? false;
  const isSuggested = !!avatar?.suggested;

  const avatarDefinition = useAvatar({
    identifier: avatar?.identifier ?? '',
    name: avatar?.name ?? '',
    imageDefinition:
      avatar?.type === 'upload'
        ? {type: 'upload', uploadUrl: avatar.uploadUrl}
        : avatar?.type === 'gravatar'
          ? {type: 'gravatar', gravatarId: avatar.gravatarId}
          : undefined,
  });

  const colors = useAvatarColors(isSuggested ? undefined : avatar);

  const contextSize = useSizeContext();
  const size = explicitSize ?? contextSize ?? 'md';

  if (!avatar) {
    return (
      <StyledAvatarButton {...props} size={size} round={round} chonk={undefined}>
        <AvatarContainer
          size={size}
          round={round}
          padded={false}
          borderColor={theme.tokens.border.primary}
          borderStyle="solid"
        >
          <EmptyAvatarIcon />
        </AvatarContainer>
      </StyledAvatarButton>
    );
  }

  if (avatarDefinition.type === 'letter') {
    const avatarChonk = colors.type === 'letter' ? colors.chonk : undefined;

    return (
      <StyledAvatarButton {...props} size={size} round={round} chonk={avatarChonk}>
        <AvatarContainer
          size={size}
          round={round}
          padded={false}
          borderColor={
            avatarChonk ??
            (isSuggested ? theme.tokens.border.neutral.vibrant : 'transparent')
          }
          borderStyle={isSuggested ? 'dashed' : 'solid'}
        >
          <StyledLetterAvatar
            configuration={avatarDefinition.configuration}
            suggested={isSuggested}
          />
        </AvatarContainer>
      </StyledAvatarButton>
    );
  }

  const chonk = colors.type === 'image' ? colors.chonk : undefined;

  return (
    <StyledAvatarButton {...props} size={size} round={round} chonk={chonk}>
      <AvatarContainer
        size={size}
        round={round}
        padded={colors.type === 'image' && colors.style === 'padded'}
        borderColor={
          chonk ?? (isSuggested ? theme.tokens.border.neutral.vibrant : 'transparent')
        }
        borderStyle={isSuggested ? 'dashed' : 'solid'}
      >
        <StyledImageAvatar
          configuration={avatarDefinition.configuration}
          suggested={isSuggested}
        />
      </AvatarContainer>
    </StyledAvatarButton>
  );
}

const EmptyAvatarIcon = styled(IconUser)`
  width: 60%;
  height: 60%;
  margin: auto;
  position: absolute;
  inset: 0;
  color: ${p => p.theme.tokens.content.secondary};
`;

const AvatarContainer = styled('div')<{
  borderColor: string;
  borderStyle: 'dashed' | 'solid';
  round: boolean;
  size: AvatarButtonSize;
  padded?: boolean;
}>`
  width: 100%;
  height: 100%;
  overflow: hidden;
  border: 1px ${p => p.borderStyle} ${p => p.borderColor};
  will-change: transform;
  border-radius: ${p =>
    p.round
      ? '50%'
      : p.size === 'md'
        ? p.theme.radius.lg
        : p.size === 'sm'
          ? p.theme.radius.md
          : p.size === 'xs'
            ? p.theme.radius.sm
            : p.theme.radius.xs};
  padding: ${p => (p.padded ? p.theme.space.xs : '0')};
  background: ${p => (p.padded ? p.theme.tokens.background.primary : 'transparent')};
  position: relative;
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
  round: boolean;
  size: AvatarButtonSize;
};

function AvatarButtonBase({
  chonk: _chonk,
  round: _round,
  ...props
}: ResolvedAvatarButtonProps) {
  return <Button {...props} />;
}

const StyledAvatarButton = styled(AvatarButtonBase)`
  padding: 0;
  width: ${p => p.theme.form[p.size].height};
  min-width: ${p => p.theme.form[p.size].height};

  ${p =>
    p.round &&
    css`
      &&,
      &&::before,
      &&::after {
        border-radius: ${p.theme.radius.full};
      }
    `}

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
