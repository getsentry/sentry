import {useCallback, useRef} from 'react';

import {trackAnalytics} from 'sentry/utils/analytics';
import useReplayLayout from 'sentry/utils/replays/hooks/useReplayLayout';
import useOrganization from 'sentry/utils/useOrganization';

type CSSValuePct = `${number}%`;
type CSSValueFR = '1fr';

type Options = {
  slideDirection: 'updown' | 'leftright';
};

function useSplitPanelTracking({slideDirection}: Options) {
  const organization = useOrganization();
  const {getLayout} = useReplayLayout();
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
      trackAnalytics('replay.details-resized-panel', {
        organization,
        layout: getLayout(),
        slide_motion: endSizeCSS > startSizeCSSRef.current ? bigger : smaller,
      });
    },
    [getLayout, organization, slideDirection]
  );

  return {
    setStartPosition,
    logEndPosition,
  };
}

export default useSplitPanelTracking;
