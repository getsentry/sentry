import {useMemo} from 'react';
import debounce from 'lodash/debounce';

import {SplitPanel} from '@sentry/scraps/splitPanel';

import {trackAnalytics} from 'sentry/utils/analytics';
import type {LayoutKey} from 'sentry/utils/replays/hooks/useReplayLayout';
import {useSplitPanelTracking} from 'sentry/utils/replays/hooks/useSplitPanelTracking';
import {useOrganization} from 'sentry/utils/useOrganization';

type Orientation = 'horizontal' | 'vertical';

type Props = {
  /**
   * Measured size of the container along the split axis (width for
   * horizontal, height for vertical). Used to log the end position as a
   * percentage for analytics. The parent already measures the layout for
   * its own grid, so threading it through avoids a second measurement.
   */
  availableSize: number;
  children: React.ReactNode;
  layout: LayoutKey;
  orientation: Orientation;
};

export function ReplaySplitPanel({availableSize, children, layout, orientation}: Props) {
  const organization = useOrganization();
  const {setStartPosition, logEndPosition} = useSplitPanelTracking({
    slideDirection: orientation === 'horizontal' ? 'leftright' : 'updown',
    track: ({slideMotion}) => {
      trackAnalytics('replay.details-resized-panel', {
        organization,
        layout,
        slide_motion: slideMotion,
      });
    },
  });

  const handleResize = useMemo(
    () =>
      debounce(
        (newSize: number) => logEndPosition(`${(newSize / availableSize) * 100}%`),
        750
      ),
    [logEndPosition, availableSize]
  );

  return (
    <SplitPanel.Root
      orientation={orientation}
      onMouseDown={setStartPosition}
      onResize={handleResize}
    >
      {children}
    </SplitPanel.Root>
  );
}
