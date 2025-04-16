import {useState} from 'react';
import styled from '@emotion/styled';

import {CodeSnippet} from 'sentry/components/codeSnippet';
import {Button} from 'sentry/components/core/button';
import {SegmentedLoadingBar} from 'sentry/components/segmentedLoadingBar';
import SizingWindow from 'sentry/components/stories/sizingWindow';
import storyBook from 'sentry/stories/storyBook';
import {space} from 'sentry/styles/space';

export default storyBook('SegmentedLoadingBar', story => {
  story('Default', () => (
    <div>
      <p>
        The segmented loading bar is a style of loader that indicates progress by showing
        a series of segments that fill in as the loading progresses. The currently active
        segment is highlighted by a pulsing animation.
      </p>
      <Column style={{marginBottom: space(2)}}>
        <SegmentedLoadingBar segments={3} phase={0} />
        <SegmentedLoadingBar segments={5} phase={1} />
        <SegmentedLoadingBar segments={3} phase={3} />
      </Column>

      <p>
        The <code>segments</code> prop is the number of segments to display. The{' '}
        <code>phase</code> prop is the index of the segment that is currently active.
      </p>
      <SizingWindow style={{marginBottom: space(2)}}>
        <Column>
          <SegmentedLoadingBar segments={3} phase={0} />
          <SegmentedLoadingBar segments={3} phase={1} />
          <SegmentedLoadingBar segments={5} phase={1} />
        </Column>
      </SizingWindow>

      <p>
        The loading bar can be used to indicate the progress of a task that is
        transitioning between phases.
      </p>
      <LoadingBarWithNextPhaseControl />
    </div>
  ));

  story('Usage Example', () => (
    <CodeSnippet language="tsx">
      {`
import {SegmentedLoadingBar} from 'sentry/components/segmentedLoadingBar';


function LoadingBarWithNextPhaseControl() {
  const [phase, setPhase] = useState(0);
  const MAX_SEGMENTS = 3;

  return (
    <Row>
      <Button
        onClick={() => {
          if (phase < MAX_SEGMENTS - 1) {
            setPhase(phase + 1);
          } else {
            setPhase(0);
          }
        }}
      >
        Next Phase
      </Button>
      <div style={{width: '100%'}}>
        <SegmentedLoadingBar segments={MAX_SEGMENTS} phase={phase} />
      </div>
    </Row>
  );
}
      `}
    </CodeSnippet>
  ));
});

function LoadingBarWithNextPhaseControl() {
  const [phase, setPhase] = useState(0);
  const MAX_SEGMENTS = 3;

  return (
    <Row>
      <Button
        onClick={() => {
          if (phase < MAX_SEGMENTS - 1) {
            setPhase(phase + 1);
          } else {
            setPhase(0);
          }
        }}
      >
        Next Phase
      </Button>
      <div style={{width: '100%'}}>
        <SegmentedLoadingBar segments={MAX_SEGMENTS} phase={phase} />
      </div>
    </Row>
  );
}

const Column = styled('div')`
  display: flex;
  flex-direction: column;
  gap: ${space(1)};
  width: 100%;
`;

const Row = styled('div')`
  display: flex;
  flex-direction: row;
  gap: ${space(1)};
  align-items: center;
`;
