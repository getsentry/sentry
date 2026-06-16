import {useCallback} from 'react';
import debounce from 'lodash/debounce';

import type {SplitPanelProps} from 'sentry/components/splitPanel';
import {SplitPanel} from 'sentry/components/splitPanel';
import {trackAnalytics} from 'sentry/utils/analytics';
import type {LayoutKey} from 'sentry/utils/replays/hooks/useReplayLayout';
import {useSplitPanelTracking} from 'sentry/utils/replays/hooks/useSplitPanelTracking';
import {useOrganization} from 'sentry/utils/useOrganization';

export function ReplaySplitPanel({
  layout,
  ...props
}: SplitPanelProps & {layout: LayoutKey}) {
  const {availableSize} = props;
  const isLeftRight = 'left' in props;
  const organization = useOrganization();
  const {setStartPosition, logEndPosition} = useSplitPanelTracking({
    slideDirection: isLeftRight ? 'leftright' : 'updown',
    track: ({slideMotion}) => {
      trackAnalytics('replay.details-resized-panel', {
        organization,
        layout,
        slide_motion: slideMotion,
      });
    },
  });

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const handleResize = useCallback(
    debounce(newSize => logEndPosition(`${(newSize / availableSize) * 100}%`), 750),
    [logEndPosition, availableSize]
  );

  const handleMouseDown = useCallback(
    (sizePct: `${number}%`) => {
      setStartPosition(sizePct);
    },
    [setStartPosition]
  );

  return <SplitPanel {...props} onMouseDown={handleMouseDown} onResize={handleResize} />;
}
