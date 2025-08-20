import {useState} from 'react';
import styled from '@emotion/styled';

import {UserAvatar} from 'sentry/components/core/avatar/userAvatar';
import type {UserAvatarProps} from 'sentry/components/core/avatar/userAvatar';
import {Tooltip} from 'sentry/components/core/tooltip';
import {IconEdit} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';

interface AvatarWithEditIconProps extends UserAvatarProps {
  onEditClick: () => void;
}

export function AvatarWithEditIcon({
  onEditClick,
  ...avatarProps
}: AvatarWithEditIconProps) {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <AvatarContainer
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <UserAvatar {...avatarProps} hasTooltip={false} />
      <Tooltip title={t('Edit Avatar')} disabled={!isHovered} position="right">
        <EditIconOverlay
          isVisible={isHovered}
          onClick={e => {
            e.stopPropagation();
            e.preventDefault();
            onEditClick();
          }}
        >
          <IconEdit size="xs" />
        </EditIconOverlay>
      </Tooltip>
    </AvatarContainer>
  );
}

const AvatarContainer = styled('div')`
  position: relative;
  display: inline-block;
  cursor: pointer;

  /* Ensure hover area covers the entire avatar */
  &::after {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    pointer-events: none;
  }
`;

const EditIconOverlay = styled('div')<{isVisible: boolean}>`
  position: absolute;
  bottom: -2px;
  right: -2px;
  width: 18px;
  height: 18px;
  background: ${p => p.theme.button.default.background};
  border: 1px solid ${p => p.theme.button.default.border};
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  opacity: ${p => (p.isVisible ? 1 : 0)};
  transform: ${p => (p.isVisible ? 'scale(1)' : 'scale(0.8)')};
  transition:
    opacity 0.2s ease,
    transform 0.2s ease;
  z-index: 10;
  pointer-events: ${p => (p.isVisible ? 'auto' : 'none')};

  &:hover {
    background: ${p => p.theme.hover};
    border-color: ${p => p.theme.button.default.borderActive};
  }

  svg {
    color: ${p => p.theme.button.default.color};
    width: 10px;
    height: 10px;
  }

  &:hover svg {
    color: ${p => p.theme.button.default.colorActive};
  }
`;
