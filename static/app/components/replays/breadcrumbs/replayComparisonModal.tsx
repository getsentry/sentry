import {useEffect, useState} from 'react';
import beautify from 'js-beautify';

import {ModalRenderProps} from 'sentry/actionCreators/modal';
import {Flex} from 'sentry/components/profiling/flex';
import {
  Provider as ReplayContextProvider,
  useReplayContext,
} from 'sentry/components/replays/replayContext';
import ReplayPlayer from 'sentry/components/replays/replayPlayer';
import SplitDiff from 'sentry/components/splitDiff';
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

  const [leftBody, setLeftBody] = useState(null);
  const [rightBody, setRightBody] = useState(null);

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
            <div id="leftSide" style={{display: 'contents', width: '50%'}}>
              <ReplaySide
                selector="#leftSide iframe"
                expectedTime={leftTimestamp - 1}
                onLoad={setLeftBody}
              />
            </div>
          </ReplayContextProvider>
          <ReplayContextProvider
            isFetching={fetching}
            replay={replay}
            initialTimeOffsetMs={{offsetMs: rightTimestamp + 1}}
          >
            <div id="rightSide" style={{display: 'contents', width: '50%'}}>
              <ReplaySide
                selector="#rightSide iframe"
                expectedTime={rightTimestamp + 1}
                onLoad={setRightBody}
              />
            </div>
          </ReplayContextProvider>
        </Flex>
        <Flex>
          {leftBody && rightBody ? (
            <SplitDiff base={leftBody} target={rightBody} type="words" />
          ) : null}
        </Flex>
      </Body>
    </OrganizationContext.Provider>
  );
}

function ReplaySide({expectedTime, selector, onLoad}) {
  const {currentTime} = useReplayContext();

  useEffect(() => {
    if (currentTime === expectedTime) {
      setTimeout(() => {
        const iframe = document.querySelector(selector) as HTMLIFrameElement;
        const body = iframe.contentWindow?.document.body;
        if (body) {
          onLoad(
            beautify.html(body.innerHTML, {
              indent_size: 2,
            })
          );
        }
      }, 0);
    }
  }, [currentTime, expectedTime, selector, onLoad]);
  return <ReplayPlayer isPreview />;
}
