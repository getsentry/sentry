import {useCallback, useRef} from 'react';

type CSSValuePct = `${number}%`;
type CSSValueFR = '1fr';

type TrackingCallback = (params: {
  slideMotion: 'toTop' | 'toBottom' | 'toLeft' | 'toRight';
}) => void;

type Options = {
  slideDirection: 'updown' | 'leftright';
  track: TrackingCallback | undefined;
};

export function useSplitPanelTracking({slideDirection, track}: Options) {
  const startSizeCSSRef = useRef<number>(0);

  const setStartPosition = useCallback(
    (startPosition: undefined | CSSValuePct | CSSValueFR) => {
      startSizeCSSRef.current = Number(startPosition?.replace('%', '') || 0);
    },
    []
  );

  const logEndPosition = useCallback(
    (endPosition: undefined | CSSValuePct | CSSValueFR) => {
      const smaller = slideDirection === 'updown' ? 'toTop' : 'toLeft';
      const bigger = slideDirection === 'updown' ? 'toBottom' : 'toRight';
      const endSizeCSS = Number(
        endPosition?.endsWith('fr') ? '50' : endPosition?.replace('%', '') || 0
      );
      track?.({slideMotion: endSizeCSS > startSizeCSSRef.current ? bigger : smaller});
    },
    [slideDirection, track]
  );

  return {
    setStartPosition,
    logEndPosition,
  };
}
