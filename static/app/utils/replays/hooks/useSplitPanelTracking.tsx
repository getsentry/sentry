import {useCallback, useRef} from 'react';

import trackAdvancedAnalyticsEvent from 'sentry/utils/analytics/trackAdvancedAnalyticsEvent';
import useReplayLayout from 'sentry/utils/replays/hooks/useReplayLayout';
import useOrganization from 'sentry/utils/useOrganization';

type CSSValuePct = `${number}%`;

function useSplitPanelTracking({
  slideDirection,
}: {
  slideDirection: 'updown' | 'leftright';
}) {
  const organization = useOrganization();
  const {getLayout} = useReplayLayout();
  const startSizeCSSRef = useRef<number>(0);

  const setStartPosition = useCallback((startPosition: undefined | CSSValuePct) => {
    startSizeCSSRef.current = Number(startPosition?.replace('%', '') || 0);
  }, []);

  const logEndPosition = useCallback(
    (endPosition: undefined | CSSValuePct) => {
      const smaller = slideDirection === 'updown' ? 'toTop' : 'toLeft';
      const bigger = slideDirection === 'updown' ? 'toBottom' : 'toRight';
      const endSizeCSS = Number(endPosition?.replace('%', '') || 0);
      trackAdvancedAnalyticsEvent('replay-details.resized-panel', {
        organization,
        layout: getLayout(),
        slideMotion: endSizeCSS > startSizeCSSRef.current ? bigger : smaller,
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
