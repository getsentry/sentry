import styled from '@emotion/styled';

import {space} from 'sentry/styles/space';

import {useLottieCharacter} from './useLottieCharacter';

interface SeeryCharacterProps {
  animationData: any;
  showDebugInfo?: boolean;
  size?: number;
}

function SeeryCharacter({
  animationData,
  showDebugInfo = false,
  size,
}: SeeryCharacterProps) {
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
    <CharacterContainer size={size}>
      <AnimationContainer size={size}>{View}</AnimationContainer>
      {showDebugInfo && (
        <DebugInfo>
          <div>Playing: {state.isPlaying ? 'Yes' : 'No'}</div>
          <div>Frame: {state.currentFrame}</div>
          <div>Speed: {state.speed}x</div>
        </DebugInfo>
      )}
    </CharacterContainer>
  );
}

const CharacterContainer = styled('div')<{size?: number}>`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: ${space(1)};
  ${p => p.size && `width: ${p.size}px; height: ${p.size}px;`}
`;

const AnimationContainer = styled('div')<{size?: number}>`
  width: 100%;
  height: 100%;
  border-radius: 8px;
  overflow: hidden;

  /* Optional: Add subtle background */
  /* Ensure animation scales properly */
  svg {
    width: 100% !important;
    height: 100% !important;
    ${p =>
      p.size && `max-width: ${p.size}px !important; max-height: ${p.size}px !important;`}
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
