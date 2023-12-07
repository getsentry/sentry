import {useCallback} from 'react';
import debounce from 'lodash/debounce';

import SplitPanel, {SplitPanelProps} from 'sentry/components/splitPanel';
import useSplitPanelTracking from 'sentry/utils/replays/hooks/useSplitPanelTracking';

function ReplaySplitPanel(props: SplitPanelProps) {
  const {availableSize} = props;
  const isLeftRight = 'left' in props;

  const {setStartPosition, logEndPosition} = useSplitPanelTracking({
    slideDirection: isLeftRight ? 'leftright' : 'updown',
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

export default ReplaySplitPanel;
