import {Fragment, useEffect, useState} from 'react';
import styled from '@emotion/styled';
import beautify from 'js-beautify';

import {ModalRenderProps} from 'sentry/actionCreators/modal';
import {CopyToClipboardButton} from 'sentry/components/copyToClipboardButton';
import FeatureBadge from 'sentry/components/featureBadge';
import {GithubFeedbackButton} from 'sentry/components/githubFeedbackButton';
import {Flex} from 'sentry/components/profiling/flex';
import {
  Provider as ReplayContextProvider,
  useReplayContext,
} from 'sentry/components/replays/replayContext';
import ReplayPlayer from 'sentry/components/replays/replayPlayer';
import SplitDiff from 'sentry/components/splitDiff';
import {TabList} from 'sentry/components/tabs';
import {t, tct} from 'sentry/locale';
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

  const [activeTab, setActiveTab] = useState<'visual' | 'html'>('html');

  const [leftBody, setLeftBody] = useState(null);
  const [rightBody, setRightBody] = useState(null);

  return (
    <OrganizationContext.Provider value={organization}>
      <Header closeButton>
        <ModalHeader>
          <h4>
            Hydration Error
            <FeatureBadge type="beta" />
          </h4>
          <GithubFeedbackButton
            href="https://github.com/getsentry/sentry/discussions/62097"
            label={t('Discussion')}
            title={null}
            analyticsEventKey="replay.details-hydration-discussion-clicked"
            analyticsEventName="Replay Details Hydration Discussion Clicked"
            priority="primary"
          />
        </ModalHeader>
      </Header>
      <Body>
        <StyledParagraph>
          {tct(
            'This modal helps with debugging hydration errors by diffing the dom before and after the app hydrated. [boldBefore:Before Hydration] refers to the html rendered on the server. [boldAfter:After Hydration] refers to the html rendered on the client. This feature is actively being developed; please share any questions or feedback to the discussion linked above.',
            {
              boldBefore: <strong />,
              boldAfter: <strong />,
            }
          )}
        </StyledParagraph>
        <Flex gap={space(1)} column>
          <TabList
            selectedKey={activeTab}
            onSelectionChange={tab => setActiveTab(tab as 'visual' | 'html')}
          >
            <TabList.Item key="html">Html Diff</TabList.Item>
            <TabList.Item key="visual">Visual Diff</TabList.Item>
          </TabList>
          <Flex
            gap={space(2)}
            style={{
              // Using css to hide since the splitdiff uses the html from the iframes
              // TODO: This causes a bit of a flash when switching tabs
              display: activeTab === 'visual' ? undefined : 'none',
            }}
          >
            <ReplayContextProvider
              isFetching={fetching}
              replay={replay}
              initialTimeOffsetMs={{offsetMs: leftTimestamp - 1}}
            >
              <ComparisonSideWrapper id="leftSide">
                <ReplaySide
                  selector="#leftSide iframe"
                  expectedTime={leftTimestamp - 1}
                  onLoad={setLeftBody}
                />
              </ComparisonSideWrapper>
            </ReplayContextProvider>
            <ReplayContextProvider
              isFetching={fetching}
              replay={replay}
              initialTimeOffsetMs={{offsetMs: rightTimestamp + 1}}
            >
              <ComparisonSideWrapper id="rightSide">
                <ReplaySide
                  selector="#rightSide iframe"
                  expectedTime={rightTimestamp + 1}
                  onLoad={setRightBody}
                />
              </ComparisonSideWrapper>
            </ReplayContextProvider>
          </Flex>
          {activeTab === 'html' && leftBody && rightBody ? (
            <Fragment>
              <DiffHeader>
                <Flex flex="1" align="center">
                  {t('Before Hydration')}
                  <CopyToClipboardButton
                    text={leftBody}
                    size="xs"
                    iconSize="xs"
                    borderless
                    aria-label={t('Copy Before')}
                  />
                </Flex>
                <Flex flex="1" align="center">
                  {t('After Hydration')}
                  <CopyToClipboardButton
                    text={rightBody}
                    size="xs"
                    iconSize="xs"
                    borderless
                    aria-label={t('Copy After')}
                  />
                </Flex>
              </DiffHeader>
              <SplitDiffScrollWrapper>
                <SplitDiff base={leftBody} target={rightBody} type="words" />
              </SplitDiffScrollWrapper>
            </Fragment>
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
      }, 0);
    }
  }, [currentTime, expectedTime, selector, onLoad]);
  return <ReplayPlayer isPreview />;
}

const ModalHeader = styled('div')`
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-direction: row;
`;

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
  font-weight: 600;
  line-height: 1.2;

  div:last-child {
    padding-left: ${space(2)};
  }
`;

const StyledParagraph = styled('p')`
  padding-top: ${space(0.5)};
  margin-bottom: ${space(1)};
`;
