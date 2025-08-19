import {useCallback, useState} from 'react';
import {useLottie} from 'lottie-react';

interface LottieCharacterState {
  currentFrame: number;
  isPlaying: boolean;
  speed: number;
}

interface LottieCharacterControls {
  getState: () => LottieCharacterState;
  pause: () => void;
  play: () => void;
  reset: () => void;
  setSpeed: (speed: number) => void;
  stop: () => void;
}

interface UseLottieCharacterOptions {
  animationData: any;
  autoplay?: boolean;
  defaultSpeed?: number;
  onComplete?: () => void;
  onFrameChange?: (frame: number) => void;
}

export function useLottieCharacter({
  animationData,
  defaultSpeed = 1,
  autoplay = true,
  onComplete,
  onFrameChange,
}: UseLottieCharacterOptions) {
  const [state, setState] = useState<LottieCharacterState>({
    isPlaying: autoplay,
    currentFrame: 0,
    speed: defaultSpeed,
  });

  const lottieOptions = {
    animationData,
    loop: true,
    autoplay,
    onComplete: () => {
      setState(prev => ({...prev, isPlaying: false}));
      onComplete?.();
    },
    onEnterFrame: (event: any) => {
      const currentFrame = Math.round(event.currentTime);
      setState(prev => ({...prev, currentFrame}));
      onFrameChange?.(currentFrame);
    },
  };

  const {View, play, pause, stop, setSpeed} = useLottie(lottieOptions);

  const controls: LottieCharacterControls = {
    play: useCallback(() => {
      play();
      setState(prev => ({...prev, isPlaying: true}));
    }, [play]),

    pause: useCallback(() => {
      pause();
      setState(prev => ({...prev, isPlaying: false}));
    }, [pause]),

    stop: useCallback(() => {
      stop();
      setState(prev => ({
        ...prev,
        isPlaying: false,
        currentFrame: 0,
      }));
    }, [stop]),

    setSpeed: useCallback(
      (speed: number) => {
        setSpeed(speed);
        setState(prev => ({...prev, speed}));
      },
      [setSpeed]
    ),

    reset: useCallback(() => {
      stop();
      setSpeed(defaultSpeed);
      setState({
        isPlaying: false,
        currentFrame: 0,
        speed: defaultSpeed,
      });
    }, [stop, setSpeed, defaultSpeed]),

    getState: useCallback(() => state, [state]),
  };

  return {
    View,
    controls,
    state,
  };
}

export type {LottieCharacterControls, LottieCharacterState};
