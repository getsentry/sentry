import {useMemo} from 'react';
import debounce from 'lodash/debounce';

import type {SplitPanelProps} from '@sentry/scraps/splitPanel';
import {SplitPanel} from '@sentry/scraps/splitPanel';

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

  const handleResize = useMemo(
    () =>
      debounce(
        (newSize: number) => logEndPosition(`${(newSize / availableSize) * 100}%`),
        750
      ),
    [logEndPosition, availableSize]
  );

  return <SplitPanel {...props} onMouseDown={setStartPosition} onResize={handleResize} />;
}
