import {useEffect, useRef} from 'react';

import {useReplayContext} from 'sentry/components/replays/replayContext';

type Dimensions = ReturnType<typeof useReplayContext>['dimensions'];
interface Props {
  viewDimensions: Dimensions;
}

export default function ReplayIFrameRoot({viewDimensions}: Props) {
  const {dimensions: videoDimensions, isFetching, setRoot} = useReplayContext();

  const viewEl = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setRoot(isFetching ? null : viewEl.current);

    return () => setRoot(null);
  }, [setRoot, isFetching]);

  useEffect(() => {
    if (!viewEl.current) {
      return;
    }
    const scale = Math.min(
      viewDimensions.width / videoDimensions.width,
      viewDimensions.height / videoDimensions.height
    );

    viewEl.current.style['transform-origin'] = 'top left';
    viewEl.current.style.transform = `scale(${scale})`;
    viewEl.current.style.width = `${videoDimensions.width * scale}px`;
    viewEl.current.style.height = `${videoDimensions.height * scale}px`;
  }, [viewDimensions, videoDimensions]);

  return <div ref={viewEl} />;
}
