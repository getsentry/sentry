import {useTheme, css} from '@emotion/react';
import styled from '@emotion/styled';
import {IconUser} from '@sentry/icons/user';
import type {DistributedOmit} from 'type-fest';

import type {BaseAvatarProps} from '@sentry/scraps/avatar';
import {ImageAvatar, LetterAvatar, useAvatar} from '@sentry/scraps/avatar';
import {OverlayTrigger} from '@sentry/scraps/overlayTrigger';
import {useSizeContext} from '@sentry/scraps/sizeContext';

import {useAvatarColors} from './useAvatarColors';

type AvatarButtonSize = 'xs' | 'sm' | 'md';
type AvatarTriggerProps = Omit<
  React.ComponentProps<typeof OverlayTrigger.Button>,
  'onClick'
>;

interface AvatarButtonProps extends Omit<
  AvatarTriggerProps,
  'children' | 'icon' | 'variant' | 'showChevron'
> {
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

  // Only used to inset logos that don't fill the frame. The frame itself keeps
  // the default button colors, whatever the avatar's color.
  const colors = useAvatarColors(isSuggested ? undefined : avatar);
  // The avatar covers the button's own border, so redraw it in the same color.
  const borderColor = isSuggested
    ? theme.tokens.border.neutral.vibrant
    : theme.tokens.interactive.chonky.embossed.neutral.chonk;

  const contextSize = useSizeContext();
  const size = explicitSize ?? contextSize ?? 'md';

  if (!avatar) {
    return (
      <StyledAvatarButton {...props} size={size} round={round}>
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
    return (
      <StyledAvatarButton {...props} size={size} round={round}>
        <AvatarContainer
          size={size}
          round={round}
          padded={false}
          borderColor={borderColor}
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

  return (
    <StyledAvatarButton {...props} size={size} round={round}>
      <AvatarContainer
        size={size}
        round={round}
        padded={colors.type === 'image' && colors.style === 'padded'}
        borderColor={borderColor}
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

type ResolvedAvatarButtonProps = DistributedOmit<AvatarTriggerProps, 'size'> & {
  round: boolean;
  size: AvatarButtonSize;
};

function AvatarButtonBase({round: _round, ...props}: ResolvedAvatarButtonProps) {
  return <OverlayTrigger.Button {...props} showChevron={false} />;
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
`;
