import styled from '@emotion/styled';

import ContextIcon from 'sentry/components/replays/contextIcon';
import {useReplayContext} from 'sentry/components/replays/replayContext';
import {Tooltip} from 'sentry/components/tooltip';
import {space} from 'sentry/styles/space';

export default function BrowserOSIcons() {
  const {replay} = useReplayContext();
  const replayRecord = replay?.getReplay();

  return (
    <IconContainer>
      <Tooltip title={`${replayRecord?.os.name} ${replayRecord?.os.version}`}>
        <ContextIcon
          name={replayRecord?.os.name ?? ''}
          version={replayRecord?.os.version ?? undefined}
          showVersion
        />
      </Tooltip>
      <Tooltip title={`${replayRecord?.browser.name} ${replayRecord?.browser.version}`}>
        <ContextIcon
          name={replayRecord?.browser.name ?? ''}
          version={replayRecord?.browser.version ?? undefined}
          showVersion
        />
      </Tooltip>
    </IconContainer>
  );
}

const IconContainer = styled('div')`
  display: flex;
  gap: ${space(1)};
  flex-direction: row;
`;
