import {Fragment} from 'react';

import {Tooltip} from 'sentry/components/core/tooltip';
import Placeholder from 'sentry/components/placeholder';
import {useReplayContext} from 'sentry/components/replays/replayContext';
import ReplayPlatformIcon from 'sentry/components/replays/replayPlatformIcon';

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
        <ReplayPlatformIcon
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
          <ReplayPlatformIcon
            name={replayRecord?.browser.name ?? ''}
            version={replayRecord?.browser.version ?? undefined}
            showVersion
          />
        </Tooltip>
      )}
    </Fragment>
  );
}
