import {Fragment} from 'react';

import Placeholder from 'sentry/components/placeholder';
import PlatformIcon from 'sentry/components/replays/platformIcon';
import {useReplayContext} from 'sentry/components/replays/replayContext';
import {Tooltip} from 'sentry/components/tooltip';

export default function BrowserOSIcons({
  showBrowser = true,
  isLoading,
}: {
  isLoading?: boolean;
  showBrowser?: boolean;
}) {
  const {replay} = useReplayContext();
  const replayRecord = replay?.getReplay();

  return isLoading ? (
    <Placeholder width="50px" height="32px" />
  ) : (
    <Fragment>
      <Tooltip title={`${replayRecord?.os.name ?? ''} ${replayRecord?.os.version ?? ''}`}>
        <PlatformIcon
          name={replayRecord?.os.name ?? ''}
          version={replayRecord?.os.version ?? undefined}
          showVersion
        />
      </Tooltip>
      {showBrowser && (
        <Tooltip
          title={`${replayRecord?.browser.name ?? ''} ${
            replayRecord?.browser.version ?? ''
          }`}
        >
          <PlatformIcon
            name={replayRecord?.browser.name ?? ''}
            version={replayRecord?.browser.version ?? undefined}
            showVersion
          />
        </Tooltip>
      )}
    </Fragment>
  );
}
