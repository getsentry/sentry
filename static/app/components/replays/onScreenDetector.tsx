import {useRef} from 'react';

import useOnScreen from 'sentry/components/replays/useOnScreen';

type Props = {
  children: (isOnScreen: boolean) => React.ReactNode;
};

function OnScreenDetector({children}: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const isOnScreen = useOnScreen(ref);

  return <div ref={ref}>{children(isOnScreen)}</div>;
}

export default OnScreenDetector;
