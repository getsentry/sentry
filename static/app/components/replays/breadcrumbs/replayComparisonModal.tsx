import {useEffect} from 'react';

import {ModalRenderProps} from 'sentry/actionCreators/modal';
import {Flex} from 'sentry/components/profiling/flex';
import {
  Provider as ReplayContextProvider,
  useReplayContext,
} from 'sentry/components/replays/replayContext';
import ReplayPlayer from 'sentry/components/replays/replayPlayer';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {Organization} from 'sentry/types';
import ReplayReader from 'sentry/utils/replays/replayReader';
import {OrganizationContext} from 'sentry/views/organizationContext';

interface Props extends ModalRenderProps {
  leftTimestamp: number;
  organization: Organization;
  replay: null | ReplayReader;
  rightTimestamp: number;
}

export default function ReplayComparisonModal({
  Body,
  Header,
  leftTimestamp,
  organization,
  replay,
  rightTimestamp,
}: Props) {
  const fetching = false;

  return (
    <OrganizationContext.Provider value={organization}>
      <Header closeButton>
        <h4>{t('Look at them')}</h4>
      </Header>
      <Body>
        <Flex gap={space(1)}>
          <ReplayContextProvider
            isFetching={fetching}
            replay={replay}
            initialTimeOffsetMs={{offsetMs: leftTimestamp - 1}}
          >
            <Flex id="leftSide">
              <ReplaySide selector="#leftSide iframe" expectedTime={leftTimestamp - 1} />
            </Flex>
          </ReplayContextProvider>
          <ReplayContextProvider
            isFetching={fetching}
            replay={replay}
            initialTimeOffsetMs={{offsetMs: rightTimestamp + 1}}
          >
            <Flex id="rightSide">
              <ReplaySide
                selector="#rightSide iframe"
                expectedTime={rightTimestamp + 1}
              />
            </Flex>
          </ReplayContextProvider>
        </Flex>
      </Body>
    </OrganizationContext.Provider>
  );
}

function ReplaySide({expectedTime, selector}) {
  const {currentTime} = useReplayContext();

  useEffect(() => {
    if (currentTime === expectedTime) {
      const iframe = document.querySelector(selector);
      console.log({iframe});
    }
  }, [currentTime, expectedTime, selector]);
  return <ReplayPlayer isPreview />;
}
