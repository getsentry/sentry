import React, {useEffect, useState} from 'react';
import styled from '@emotion/styled';

// Import all background images
import beach1 from 'sentry-images/avatar/backgrounds/beach1.jpg';
import beach2 from 'sentry-images/avatar/backgrounds/beach2.jpg';
import beach3 from 'sentry-images/avatar/backgrounds/beach3.jpg';
import beach4 from 'sentry-images/avatar/backgrounds/beach4.jpg';
import beach5 from 'sentry-images/avatar/backgrounds/beach5.jpg';
import beach6 from 'sentry-images/avatar/backgrounds/beach6.jpg';
import bokeh1 from 'sentry-images/avatar/backgrounds/bokeh1.jpg';
import bokeh2 from 'sentry-images/avatar/backgrounds/bokeh2.jpg';
import bokeh3 from 'sentry-images/avatar/backgrounds/bokeh3.jpg';
import christmas1 from 'sentry-images/avatar/backgrounds/christmas-1.png';
import christmas2 from 'sentry-images/avatar/backgrounds/christmas-2.png';
import christmas4 from 'sentry-images/avatar/backgrounds/christmas-4.png';
import glow3 from 'sentry-images/avatar/backgrounds/glow3.jpg';
import halloween2 from 'sentry-images/avatar/backgrounds/halloween-2.jpg';
import halloween from 'sentry-images/avatar/backgrounds/halloween.jpg';
import office2 from 'sentry-images/avatar/backgrounds/office2.jpg';

import {UserAvatar} from 'sentry/components/core/avatar/userAvatar';
import type {UserAvatarProps} from 'sentry/components/core/avatar/userAvatar';
import {Tooltip} from 'sentry/components/core/tooltip';
import {IconEdit} from 'sentry/icons';
import {t} from 'sentry/locale';

// Background variations mapping
const BACKGROUND_MAP: Record<string, {backgroundImage: string; filter?: string}> = {
  'color-purple': {backgroundImage: '#6C5FC7'},
  'color-blue': {backgroundImage: '#3C74DD'},
  'color-green': {backgroundImage: '#2BA185'},
  'color-red': {backgroundImage: '#F55459'},
  'color-pink': {backgroundImage: '#F14499'},
  'color-yellow': {backgroundImage: '#EBC000'},
  beach1: {
    backgroundImage: beach1,
    filter: 'saturate(120%) brightness(110%) hue-rotate(10deg)',
  },
  beach2: {
    backgroundImage: beach2,
    filter: 'saturate(130%) brightness(115%) hue-rotate(20deg)',
  },
  beach3: {
    backgroundImage: beach3,
    filter: 'saturate(110%) brightness(105%) hue-rotate(-10deg)',
  },
  beach4: {
    backgroundImage: beach4,
    filter: 'saturate(125%) brightness(112%) hue-rotate(15deg)',
  },
  beach5: {
    backgroundImage: beach5,
    filter: 'saturate(115%) brightness(108%) hue-rotate(5deg)',
  },
  beach6: {
    backgroundImage: beach6,
    filter: 'saturate(125%) brightness(110%) hue-rotate(12deg)',
  },
  bokeh1: {
    backgroundImage: bokeh1,
    filter: 'saturate(110%) brightness(108%) blur(0.3px)',
  },
  bokeh2: {
    backgroundImage: bokeh2,
    filter: 'saturate(120%) brightness(105%) hue-rotate(15deg)',
  },
  bokeh3: {
    backgroundImage: bokeh3,
    filter: 'saturate(140%) brightness(110%) hue-rotate(270deg)',
  },
  glow3: {
    backgroundImage: glow3,
    filter: 'saturate(130%) brightness(115%) hue-rotate(180deg)',
  },
  office2: {
    backgroundImage: office2,
    filter: 'saturate(95%) brightness(102%) contrast(105%)',
  },
  christmas1: {
    backgroundImage: christmas1,
    filter: 'saturate(120%) brightness(110%) hue-rotate(5deg)',
  },
  christmas2: {
    backgroundImage: christmas2,
    filter: 'saturate(115%) brightness(108%) hue-rotate(10deg)',
  },
  christmas4: {
    backgroundImage: christmas4,
    filter: 'saturate(110%) brightness(105%) hue-rotate(-5deg)',
  },
  halloween: {
    backgroundImage: halloween,
    filter: 'saturate(130%) brightness(95%) hue-rotate(15deg)',
  },
  halloween2: {
    backgroundImage: halloween2,
    filter: 'saturate(125%) brightness(90%) hue-rotate(20deg)',
  },
  'filter-warm': {
    backgroundImage: 'linear-gradient(135deg, #ff9a9e 0%, #fecfef 100%)',
    filter: 'saturate(120%) brightness(110%) hue-rotate(10deg)',
  },
  'filter-cool': {
    backgroundImage: 'linear-gradient(135deg, #a8edea 0%, #fed6e3 100%)',
    filter: 'saturate(110%) brightness(105%) hue-rotate(-10deg)',
  },
  'filter-vintage': {
    backgroundImage: 'linear-gradient(135deg, #ffecd2 0%, #fcb69f 100%)',
    filter: 'saturate(85%) brightness(108%) sepia(20%) hue-rotate(15deg)',
  },
  'filter-dramatic': {
    backgroundImage: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    filter: 'saturate(130%) brightness(95%) contrast(120%)',
  },
  'filter-bw': {
    backgroundImage: 'none',
    filter: 'grayscale(100%) contrast(110%) brightness(105%)',
  },
};

// Get user's saved avatar variation from localStorage
function getUserAvatarVariation(userId: string): string | null {
  try {
    return localStorage.getItem(`avatar-variation-${userId}`);
  } catch {
    return null;
  }
}

// Simple state management for avatar variations
const avatarVariationListeners = new Set<() => void>();

// Save user's avatar variation to localStorage and notify all components
export function saveUserAvatarVariation(userId: string, variation: string): void {
  try {
    localStorage.setItem(`avatar-variation-${userId}`, variation);
    // Notify all listening components to re-render
    avatarVariationListeners.forEach(listener => listener());
  } catch {
    // Ignore localStorage errors
  }
}

// Subscribe to avatar variation changes
function subscribeToAvatarChanges(callback: () => void): () => void {
  avatarVariationListeners.add(callback);
  return () => avatarVariationListeners.delete(callback);
}

interface EnhancedUserAvatarProps extends UserAvatarProps {
  forceVariation?: string;
}

export function EnhancedUserAvatar({forceVariation, ...props}: EnhancedUserAvatarProps) {
  const [variation, setVariation] = useState(
    forceVariation || getUserAvatarVariation(props.user.id)
  );

  // Subscribe to avatar variation changes
  useEffect(() => {
    const unsubscribe = subscribeToAvatarChanges(() => {
      const newVariation = getUserAvatarVariation(props.user.id);
      setVariation(newVariation);
    });

    return unsubscribe;
  }, [props.user.id]);

  const backgroundConfig = variation ? BACKGROUND_MAP[variation] : null;

  console.log('🎨 EnhancedUserAvatar render:', {
    userId: props.user.id,
    variation,
    backgroundConfig,
    avatarType: props.user.avatar?.avatarType,
    avatarUrl: props.user.avatar?.avatarUrl,
    isAiGenerated: props.user.avatar?.avatarType === 'ai_generated',
  });

  // Apply backgrounds to ALL avatar types (initials, upload, AI-generated)
  if (!backgroundConfig || variation === 'original') {
    console.log('🎨 Rendering plain UserAvatar (no background)');
    return <UserAvatar {...props} />;
  }

  // For solid color variations, check if it's for initials or uploaded photos
  if (variation.startsWith('color-')) {
    const colorKey = variation.replace('color-', '');
    const colorMap: Record<string, string> = {
      purple: '#6C5FC7',
      blue: '#3C74DD',
      green: '#2BA185',
      red: '#F55459',
      pink: '#F14499',
      yellow: '#EBC000',
    };

    // If it's a letter avatar (initials), override the SVG background
    // AI avatars and uploaded photos should use background wrapper, not SVG override
    const isLetterAvatar =
      props.user.avatar?.avatarType === 'letter_avatar' ||
      (!props.user.avatar?.avatarUrl && !props.user.avatar?.avatarType);

    console.log('🎨 Avatar type detection:', {
      avatarType: props.user.avatar?.avatarType,
      hasAvatarUrl: !!props.user.avatar?.avatarUrl,
      isLetterAvatar,
      willUseColorOverride: isLetterAvatar,
    });

    if (isLetterAvatar) {
      console.log(
        '🎨 Rendering color override for initials:',
        colorKey,
        colorMap[colorKey]
      );

      return (
        <StyledUserAvatarWithColorOverride
          {...props}
          colorOverride={colorMap[colorKey]}
          style={{
            filter: backgroundConfig.filter || 'none',
            ...props.style,
          }}
        />
      );
    } else {
      // For uploaded photos AND AI avatars, treat color as a solid background
      console.log(
        '🎨 Rendering solid color background for uploaded/AI photo:',
        colorKey,
        colorMap[colorKey],
        'avatarType:',
        props.user.avatar?.avatarType
      );

      return (
        <AvatarWithBackground
          backgroundImage={colorMap[colorKey]}
          size={props.size || 40}
        >
          <StyledUserAvatar
            {...props}
            style={{
              filter: backgroundConfig.filter || 'none',
              ...props.style,
            }}
            onError={e => console.log('🤖 AI avatar image failed to load:', e.target.src)}
            onLoad={e =>
              console.log('🤖 AI avatar image loaded successfully:', e.target.src)
            }
          />
        </AvatarWithBackground>
      );
    }
  }

  // For all other variations (beach, patterns, filters, etc.) - apply background wrapper
  console.log(
    '🎨 Rendering background wrapper for uploaded photo:',
    variation,
    backgroundConfig.backgroundImage
  );
  return (
    <AvatarWithBackground
      backgroundImage={backgroundConfig.backgroundImage}
      size={props.size || 40}
    >
      <StyledUserAvatar
        {...props}
        style={{
          filter: backgroundConfig.filter || 'none',
          ...props.style,
        }}
      />
    </AvatarWithBackground>
  );
}

interface EnhancedAvatarWithEditIconProps extends EnhancedUserAvatarProps {
  onEditClick: () => void;
}

export function EnhancedAvatarWithEditIcon({
  onEditClick,
  ...props
}: EnhancedAvatarWithEditIconProps) {
  const variation = props.forceVariation || getUserAvatarVariation(props.user.id);
  const backgroundConfig = variation ? BACKGROUND_MAP[variation] : null;

  return (
    <AvatarWrapper onMouseEnter={() => {}} onMouseLeave={() => {}}>
      <EnhancedUserAvatar {...props} />
      <Tooltip title={t('Edit Avatar')} skipWrapper>
        <EditOverlay onClick={onEditClick}>
          <EditIcon />
        </EditOverlay>
      </Tooltip>
    </AvatarWrapper>
  );
}

const AvatarWithBackground = styled('div')<{backgroundImage: string; size: number}>`
  position: relative;
  width: ${p => p.size}px;
  height: ${p => p.size}px;
  border-radius: 50%;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  box-sizing: border-box;

  background: ${p => {
    if (p.backgroundImage.startsWith('linear-gradient')) {
      return p.backgroundImage;
    }
    if (p.backgroundImage.startsWith('#')) {
      return p.backgroundImage;
    }
    return `url(${p.backgroundImage})`;
  }};
  background-size: cover;
  background-position: center;
  background-repeat: no-repeat;
`;

const StyledUserAvatar = styled(UserAvatar)`
  position: relative;
  z-index: 2;
`;

const StyledUserAvatarWithColorOverride = styled(UserAvatar)<{colorOverride?: string}>`
  position: relative;
  z-index: 2;

  /* Override the letter avatar's background color */
  svg rect {
    fill: ${p => p.colorOverride} !important;
  }
`;

const AvatarWrapper = styled('div')`
  position: relative;
  display: inline-block;

  &:hover {
    > div:last-child {
      opacity: 1;
    }
  }
`;

const EditOverlay = styled('div')`
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.6);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0;
  transition: opacity 0.2s ease;
  cursor: pointer;
  z-index: 10;
`;

const EditIcon = styled(IconEdit)`
  color: white;
  width: 12px;
  height: 12px;
`;
