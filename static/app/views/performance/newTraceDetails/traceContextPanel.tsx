import {useEffect, useState} from 'react';
import styled from '@emotion/styled';

import {IconGrabbable} from 'sentry/icons';
import {space} from 'sentry/styles/space';
import type {EventTransaction} from 'sentry/types/event';
import type {UseApiQueryResult} from 'sentry/utils/queryClient';
import type RequestError from 'sentry/utils/requestError/requestError';
import WebVitalMeters from 'sentry/views/insights/browser/webVitals/components/webVitalMeters';
import type {TraceTree} from 'sentry/views/performance/newTraceDetails/traceModels/traceTree';

const MIN_HEIGHT = 0;
const DEFAULT_HEIGHT = 100;
const MAX_HEIGHT = 700;

type Props = {
  tree: TraceTree;
};

export function TraceContextPanel({tree}: Props) {
  const [isDragging, setIsDragging] = useState(false);
  const [contextPaneHeight, setContextPaneHeight] = useState(DEFAULT_HEIGHT);

  const [startY, setStartY] = useState(0);
  const [startHeight, setStartHeight] = useState(DEFAULT_HEIGHT);

  const hasVitals = tree.vital_types.has('web') && tree.indicators.length > 0;

  const handleMouseDown = (event: React.MouseEvent) => {
    event.preventDefault();

    setIsDragging(true);
    setStartY(event.clientY);
    setStartHeight(contextPaneHeight);
  };

  useEffect(() => {
    const handleMouseUp = () => {
      setIsDragging(false);
    };

    const handleDrag = (event: MouseEvent) => {
      event.preventDefault();

      const deltaY = startY - event.clientY;
      const newHeight = Math.max(MIN_HEIGHT, Math.min(startHeight + deltaY, MAX_HEIGHT));
      setContextPaneHeight(newHeight);
    };

    if (isDragging) {
      window.addEventListener('mousemove', handleDrag);
      window.addEventListener('mouseup', handleMouseUp);
    } else {
      window.removeEventListener('mousemove', handleDrag);
      window.removeEventListener('mouseup', handleMouseUp);
    }

    return () => {
      window.removeEventListener('mousemove', handleDrag);
      window.removeEventListener('mouseup', handleMouseUp);
    };
    // this hook only needs to run when isDragging changes
    // adding `deltaY` and `newHeight` as dependencies would cause unnecessary re-renders
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isDragging]);

  return (
    <Container>
      <GrabberContainer onMouseDown={handleMouseDown}>
        <IconGrabbable color="gray500" />
      </GrabberContainer>

      <TraceContextContainer height={contextPaneHeight}>
        {hasVitals && <WebVitalMeters isAggregateMode={false} />}
      </TraceContextContainer>
    </Container>
  );
}

const Container = styled('div')`
  width: 100%;
  display: flex;
  flex-direction: column;
  justify-content: center;
`;

const GrabberContainer = styled(Container)`
  align-items: center;
  background: ${p => p.theme.background};
  border: 1px solid ${p => p.theme.border};
  border-radius: 0 0 ${p => p.theme.borderRadius} ${p => p.theme.borderRadius};
  display: flex;

  width: 100%;
  cursor: row-resize;
  padding: ${space(0.5)};

  & > svg {
    transform: rotate(90deg);
  }
`;

const TraceContextContainer = styled('div')<{height: number}>`
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;

  width: 100%;
  margin-top: ${space(1)};
  background: ${p => p.theme.red300};
  height: ${p => p.height}px;
`;
