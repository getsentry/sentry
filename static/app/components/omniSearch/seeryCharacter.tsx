import styled from '@emotion/styled';

import {space} from 'sentry/styles/space';

import {useLottieCharacter} from './useLottieCharacter';

interface SeeryCharacterProps {
  /** Lottie animation data for the character */
  animationData: any;
}

function SeeryCharacter({animationData}: SeeryCharacterProps) {
  const {View, state} = useLottieCharacter({
    animationData,
    autoplay: true,
  });

  // Add basic animation controls to the omni palette
  // useOmniActions(
  //   showControls
  //     ? [
  //         {
  //           key: 'character-pause',
  //           label: t('Character: Pause'),
  //           details: t('Pause animation'),
  //           areaKey: 'character',
  //           section: t('Character'),
  //           actionIcon: undefined,
  //           onAction: () => controls.pause(),
  //         },
  //         {
  //           key: 'character-play',
  //           label: t('Character: Play'),
  //           details: t('Resume animation'),
  //           areaKey: 'character',
  //           section: t('Character'),
  //           actionIcon: undefined,
  //           onAction: () => controls.play(),
  //         },
  //         {
  //           key: 'character-reset',
  //           label: t('Character: Reset'),
  //           details: t('Reset to beginning'),
  //           areaKey: 'character',
  //           section: t('Character'),
  //           actionIcon: undefined,
  //           onAction: () => controls.reset(),
  //         },
  //       ]
  //     : []
  // );

  return (
    <CharacterContainer>
      <AnimationContainer>{View}</AnimationContainer>
      {/* Optional: Show current state for debugging */}
      {process.env.NODE_ENV === 'development' && (
        <DebugInfo>
          <div>Playing: {state.isPlaying ? 'Yes' : 'No'}</div>
          <div>Frame: {state.currentFrame}</div>
          <div>Speed: {state.speed}x</div>
        </DebugInfo>
      )}
    </CharacterContainer>
  );
}

const CharacterContainer = styled('div')`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: ${space(1)};
`;

const AnimationContainer = styled('div')`
  width: 100px;
  height: 100px;
  border-radius: 8px;
  overflow: hidden;

  /* Optional: Add subtle background */
  /* Ensure animation scales properly */
  svg {
    width: 100% !important;
    height: 100% !important;
  }
`;

const DebugInfo = styled('div')`
  font-size: 10px;
  color: #666;
  text-align: center;

  div {
    margin: 2px 0;
  }
`;

export default SeeryCharacter;
export type {SeeryCharacterProps};
