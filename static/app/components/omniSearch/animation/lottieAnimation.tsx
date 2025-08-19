import styled from '@emotion/styled';
import {useLottie} from 'lottie-react';

interface LottieAnimationProps {
  animationData: any;
  autoplay?: boolean;
  className?: string;
  height?: number | string;
  loop?: boolean;
  onComplete?: () => void;
  width?: number | string;
}

function LottieAnimation({
  animationData,
  autoplay = true,
  loop = false,
  width = '100%',
  height = '100%',
  onComplete,
  className,
}: LottieAnimationProps) {
  const {View} = useLottie({
    animationData,
    loop,
    autoplay,
    onComplete,
  });

  return (
    <Container width={width} height={height} className={className}>
      {View}
    </Container>
  );
}

interface ContainerProps {
  height: number | string;
  width: number | string;
}

const Container = styled('div')<ContainerProps>`
  width: ${p => (typeof p.width === 'number' ? `${p.width}px` : p.width)};
  height: ${p => (typeof p.height === 'number' ? `${p.height}px` : p.height)};
  display: flex;
  align-items: center;
  justify-content: center;

  /* Ensure the Lottie animation scales properly */
  svg {
    width: 100%;
    height: 100%;
  }
`;

export default LottieAnimation;
export type {LottieAnimationProps};
