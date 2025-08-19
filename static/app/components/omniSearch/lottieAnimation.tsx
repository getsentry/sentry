import {useEffect, useRef, useState} from 'react';
import styled from '@emotion/styled';
import {useLottie} from 'lottie-react';

interface LottieAnimationProps {
  /** Lottie animation data (JSON) */
  animationData: any;
  /** Whether the animation should play automatically */
  autoplay?: boolean;
  /** Additional CSS class */
  className?: string;
  /** Ending frame of the animation */
  endFrame?: number;
  /** Height of the animation container */
  height?: number | string;
  /** Whether the animation should loop */
  loop?: boolean;
  /** Callback when animation completes */
  onComplete?: () => void;
  /** Speed of the animation (1 = normal speed) */
  speed?: number;
  /** Starting frame of the animation */
  startFrame?: number;
  /** Width of the animation container */
  width?: number | string;
}

function LottieAnimation({
  animationData,
  startFrame = 0,
  endFrame,
  autoplay = true,
  loop = false,
  speed = 1,
  width = '100%',
  height = '100%',
  onComplete,
  className,
}: LottieAnimationProps) {
  const [isPlaying, setIsPlaying] = useState(autoplay);
  const hasPlayedSegment = useRef(false);

  const options = {
    animationData,
    loop: false, // We'll handle looping manually for segment control
    autoplay: false, // We'll control play manually
    onComplete: () => {
      setIsPlaying(false);
      onComplete?.();
    },
  };

  const {View, play, pause, stop, setSpeed, setDirection, goToAndPlay, goToAndStop} =
    useLottie(options);

  // Control animation playback based on frame segments
  useEffect(() => {
    if (!animationData) return;

    setSpeed(speed);

    if (isPlaying && !hasPlayedSegment.current) {
      if (startFrame !== undefined && endFrame !== undefined) {
        // Play specific segment
        goToAndPlay(startFrame, true);
        hasPlayedSegment.current = true;
      } else if (startFrame === undefined) {
        // Play normally
        play();
      } else {
        // Start from specific frame and play to end
        goToAndPlay(startFrame, true);
        hasPlayedSegment.current = true;
      }
    } else if (!isPlaying) {
      pause();
    }
  }, [
    isPlaying,
    startFrame,
    endFrame,
    speed,
    animationData,
    play,
    pause,
    goToAndPlay,
    setSpeed,
  ]);

  // Handle segment completion for looping
  useEffect(() => {
    if (loop && !isPlaying && hasPlayedSegment.current) {
      // Reset for next loop
      hasPlayedSegment.current = false;
      setIsPlaying(true);
    }
  }, [loop, isPlaying]);

  // Expose controls to parent via ref
  useEffect(() => {
    if (typeof window !== 'undefined') {
      // Public methods for controlling animation
      const animationControls = {
        play: () => {
          hasPlayedSegment.current = false;
          setIsPlaying(true);
        },
        pause: () => {
          setIsPlaying(false);
          pause();
        },
        stop: () => {
          setIsPlaying(false);
          hasPlayedSegment.current = false;
          stop();
        },
        goToFrame: (frame: number, andPlay = false) => {
          if (andPlay) {
            hasPlayedSegment.current = false;
            goToAndPlay(frame, true);
            setIsPlaying(true);
          } else {
            goToAndStop(frame, true);
            setIsPlaying(false);
          }
        },
        playSegment: (start: number, _end: number) => {
          hasPlayedSegment.current = false;
          // For segment playback, we'll go to start frame and play
          // The end frame will be handled by onComplete or manual stopping
          goToAndPlay(start, true);
          setIsPlaying(true);
        },
        setPlaybackSpeed: (newSpeed: number) => {
          setSpeed(newSpeed);
        },
        reverse: () => {
          setDirection(-1);
          if (!isPlaying) {
            setIsPlaying(true);
          }
        },
      };

      // Store controls globally for easy access (optional)
      (window as any).lottieControls = animationControls;
    }
    // Add all referenced functions/vars to dependencies for exhaustive-deps
  }, [goToAndPlay, goToAndStop, isPlaying, pause, setDirection, setSpeed, stop]);

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

// Re-export for convenience
export {useLottie};
