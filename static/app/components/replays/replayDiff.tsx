import {Fragment, useEffect, useState} from 'react';
import styled from '@emotion/styled';
import beautify from 'js-beautify';

import Alert from 'sentry/components/alert';
import {Flex} from 'sentry/components/container/flex';
import {CopyToClipboardButton} from 'sentry/components/copyToClipboardButton';
import {StaticReplayPreferences} from 'sentry/components/replays/preferences/replayPreferences';
import {
  Provider as ReplayContextProvider,
  useReplayContext,
} from 'sentry/components/replays/replayContext';
import ReplayPlayer from 'sentry/components/replays/replayPlayer';
import SplitDiff from 'sentry/components/splitDiff';
import {TabList} from 'sentry/components/tabs';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type ReplayReader from 'sentry/utils/replays/replayReader';

const MAX_CLAMP_TO_START = 2000;

interface Props {
  leftTimestamp: number;
  replay: null | ReplayReader;
  rightTimestamp: number;
}

enum Tab {
  VISUAL = 'visual',
  HTML = 'html',
}

export default function ReplayDiff({leftTimestamp, replay, rightTimestamp}: Props) {
  const fetching = false;

  const [activeTab, setActiveTab] = useState<Tab>(Tab.HTML);

  const [leftBody, setLeftBody] = useState(null);
  const [rightBody, setRightBody] = useState(null);

  let startOffset = leftTimestamp - 1;
  // If the error occurs close to the start of the replay, clamp the start offset to 1
  // to help compare with the html provided by the server, This helps with some errors on localhost.
  if (startOffset < MAX_CLAMP_TO_START) {
    startOffset = 1;
  }

  const isSameTimestamp = leftBody && rightBody && leftBody === rightBody;

  return (
    <Fragment>
      {isSameTimestamp ? (
        <Alert type="warning" showIcon>
          {t(
            "Sentry wasn't able to identify the correct event to display a diff for this hydration error."
          )}
        </Alert>
      ) : null}

      <Flex gap={space(1)} column>
        <TabList
          selectedKey={activeTab}
          onSelectionChange={tab => setActiveTab(tab as Tab)}
        >
          <TabList.Item key={Tab.HTML}>{t('Html Diff')}</TabList.Item>
          <TabList.Item key={Tab.VISUAL}>{t('Visual Diff')}</TabList.Item>
        </TabList>

        <Flex
          gap={space(2)}
          column
          style={{
            // Using css to hide since the splitdiff uses the html from the iframes
            // TODO: This causes a bit of a flash when switching tabs
            display: activeTab === Tab.VISUAL ? undefined : 'none',
          }}
        >
          <DiffHeader>
            <Flex flex="1" align="center">
              {t('Before Hydration')}
            </Flex>
            <Flex flex="1" align="center">
              {t('After Hydration')}
            </Flex>
          </DiffHeader>
          <ReplayGrid>
            <ReplayContextProvider
              analyticsContext="replay_comparison_modal_left"
              initialTimeOffsetMs={{offsetMs: startOffset}}
              isFetching={fetching}
              prefsStrategy={StaticReplayPreferences}
              replay={replay}
            >
              <ComparisonSideWrapper id="leftSide">
                <ReplaySide
                  selector="#leftSide iframe"
                  expectedTime={startOffset}
                  onLoad={setLeftBody}
                />
              </ComparisonSideWrapper>
            </ReplayContextProvider>
            <ReplayContextProvider
              analyticsContext="replay_comparison_modal_right"
              initialTimeOffsetMs={{offsetMs: rightTimestamp + 1}}
              isFetching={fetching}
              prefsStrategy={StaticReplayPreferences}
              replay={replay}
            >
              <ComparisonSideWrapper id="rightSide">
                {rightTimestamp > 0 ? (
                  <ReplaySide
                    selector="#rightSide iframe"
                    expectedTime={rightTimestamp + 1}
                    onLoad={setRightBody}
                  />
                ) : (
                  <div />
                )}
              </ComparisonSideWrapper>
            </ReplayContextProvider>
          </ReplayGrid>
        </Flex>
        {activeTab === Tab.HTML ? (
          <Fragment>
            <DiffHeader>
              <Flex flex="1" align="center">
                {t('Before Hydration')}
                <CopyToClipboardButton
                  text={leftBody ?? ''}
                  size="xs"
                  iconSize="xs"
                  borderless
                  aria-label={t('Copy Before')}
                />
              </Flex>
              <Flex flex="1" align="center">
                {t('After Hydration')}
                <CopyToClipboardButton
                  text={rightBody ?? ''}
                  size="xs"
                  iconSize="xs"
                  borderless
                  aria-label={t('Copy After')}
                />
              </Flex>
            </DiffHeader>
            <SplitDiffScrollWrapper>
              <SplitDiff base={leftBody ?? ''} target={rightBody ?? ''} type="words" />
            </SplitDiffScrollWrapper>
          </Fragment>
        ) : null}
      </Flex>
    </Fragment>
  );
}

function ReplaySide({expectedTime, selector, onLoad}) {
  const {currentTime} = useReplayContext();

  useEffect(() => {
    if (currentTime === expectedTime) {
      // Wait for the replay iframe to load before selecting the body
      setTimeout(() => {
        const iframe = document.querySelector<HTMLIFrameElement>(selector)!;
        const body = iframe.contentWindow?.document.body;
        if (body) {
          onLoad(
            beautify.html(body.innerHTML, {
              indent_size: 2,
            })
          );
        }
      }, 50);
    }
  }, [currentTime, expectedTime, selector, onLoad]);
  return <ReplayPlayer isPreview />;
}

const ComparisonSideWrapper = styled('div')`
  display: contents;
  flex-grow: 1;
  max-width: 50%;
`;

const SplitDiffScrollWrapper = styled('div')`
  height: 65vh;
  overflow: auto;
`;

const DiffHeader = styled('div')`
  display: flex;
  flex-direction: row;
  align-items: center;
  flex: 1;
  font-weight: ${p => p.theme.fontWeightBold};
  line-height: 1.2;

  div {
    height: 28px; /* div with and without buttons inside are the same height */
  }

  div:last-child {
    padding-left: ${space(2)};
  }
`;

const ReplayGrid = styled('div')`
  display: grid;
  grid-template-columns: 1fr 1fr;
`;
