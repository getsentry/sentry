import {useEffect, useState} from 'react';
import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';

import {IconGrabbable} from 'sentry/icons';
import {space} from 'sentry/styles/space';
import {VitalMeter} from 'sentry/views/insights/browser/webVitals/components/webVitalMeters';
import type {WebVitals} from 'sentry/views/insights/browser/webVitals/types';
import type {TraceTree} from 'sentry/views/performance/newTraceDetails/traceModels/traceTree';

const MIN_HEIGHT = 0;
const DEFAULT_HEIGHT = 100;
const MAX_HEIGHT = 700;

type Props = {
  tree: TraceTree;
};

const ALLOWED_VITALS = ['lcp', 'fcp', 'cls', 'ttfb', 'inp'];

export function TraceContextPanel({tree}: Props) {
  const theme = useTheme();
  const [isDragging, setIsDragging] = useState(false);
  const [contextPaneHeight, setContextPaneHeight] = useState(DEFAULT_HEIGHT);

  const [startY, setStartY] = useState(0);
  const [startHeight, setStartHeight] = useState(DEFAULT_HEIGHT);

  const hasWebVitals = tree.vital_types.has('web'); // && tree.vitals.filter(v => ALLOWED_VITALS.includes(v.key)).length > 0;
  const hasValidWebVitals = () => {
    let hasValidVitals = false;

    tree.vitals.forEach(v => {
      hasValidVitals = v.some(vital => ALLOWED_VITALS.includes(vital.key));
    });

    return hasValidVitals;
  };

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

  const renderVitals = () => {
    if (!hasWebVitals || !hasValidWebVitals()) {
      return null;
    }

    console.dir(tree.vitals);

    return ALLOWED_VITALS.map((webVital, index) => {
      let vital: TraceTree.CollectedVital | undefined;
      tree.vitals.forEach(v => (vital = v.find(vital => vital.key === webVital)));

      if (!vital || !vital.score) {
        return (
          <VitalMeter
            key={webVital}
            webVital={webVital as WebVitals}
            score={undefined}
            meterValue={undefined}
            color={theme.charts.getColorPalette(3)[index]}
            showTooltip
          />
        );
      }

      const colors = theme.charts.getColorPalette(3);
      const score = Math.round(vital.score * 100);

      return (
        <VitalMeter
          key={vital.key}
          webVital={vital.key as WebVitals}
          score={score}
          meterValue={vital.measurement.value}
          showTooltip
          color={colors[index]}
        />
      );
    });
  };

  return (
    <Container>
      <GrabberContainer onMouseDown={handleMouseDown}>
        <IconGrabbable color="gray500" />
      </GrabberContainer>

      <TraceContextContainer height={contextPaneHeight}>
        <VitalMetersContainer>{renderVitals()}</VitalMetersContainer>
        <TraceTagsContainer />
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
  align-items: center;

  width: 100%;
  margin-top: ${space(1)};
  height: ${p => p.height}px;
`;

const VitalMetersContainer = styled('div')`
  justify-content: center;
  display: flex;
  flex-direction: row;
  gap: ${space(1)};
  width: 100%;
  margin-bottom: ${space(1)};

  > div {
    max-width: 200px;
  }
`;

const TraceTagsContainer = styled('div')`
  width: 100%;
  height: 200px;
  border: 1px solid ${p => p.theme.border};
  border-radius: ${p => p.theme.borderRadius};
`;
