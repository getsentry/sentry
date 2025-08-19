import styled from '@emotion/styled';
import {useLottie} from 'lottie-react';

interface SeeryCharacterProps {
  animationData: any;
  size?: number;
}

function SeeryCharacter({animationData, size}: SeeryCharacterProps) {
  const {View} = useLottie({
    animationData,
    autoplay: true,
    loop: true,
  });

  return (
    <CharacterContainer size={size}>
      <AnimationContainer size={size}>{View}</AnimationContainer>
    </CharacterContainer>
  );
}

const CharacterContainer = styled('div')<{size?: number}>`
  display: flex;
  align-items: center;
  justify-content: center;
  ${p => p.size && `width: ${p.size}px; height: ${p.size}px;`}
`;

const AnimationContainer = styled('div')<{size?: number}>`
  width: 100%;
  height: 100%;

  svg {
    width: 100% !important;
    height: 100% !important;
    ${p =>
      p.size && `max-width: ${p.size}px !important; max-height: ${p.size}px !important;`}
  }
`;

export default SeeryCharacter;
export type {SeeryCharacterProps};
