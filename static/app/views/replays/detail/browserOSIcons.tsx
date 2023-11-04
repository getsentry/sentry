import {Fragment} from 'react';

import ContextIcon from 'sentry/components/replays/contextIcon';
import {useReplayContext} from 'sentry/components/replays/replayContext';
import {Tooltip} from 'sentry/components/tooltip';

export default function BrowserOSIcons() {
  const {replay} = useReplayContext();
  const replayRecord = replay?.getReplay();

  return (
    <Fragment>
      <Tooltip title={`${replayRecord?.os.name ?? ''} ${replayRecord?.os.version ?? ''}`}>
        <ContextIcon
          name={replayRecord?.os.name ?? ''}
          version={replayRecord?.os.version ?? undefined}
          showVersion
        />
      </Tooltip>
      <Tooltip
        title={`${replayRecord?.browser.name ?? ''} ${
          replayRecord?.browser.version ?? ''
        }`}
      >
        <ContextIcon
          name={replayRecord?.browser.name ?? ''}
          version={replayRecord?.browser.version ?? undefined}
          showVersion
        />
      </Tooltip>
    </Fragment>
  );
}
