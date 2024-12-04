import {useCallback, useEffect, useRef, useState} from 'react';
import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';

import EventTagsTree from 'sentry/components/events/eventTags/eventTagsTree';
import {IconGrabbable} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {EventTransaction} from 'sentry/types/event';
import type {UseApiQueryResult} from 'sentry/utils/queryClient';
import type RequestError from 'sentry/utils/requestError/requestError';
import {VitalMeter} from 'sentry/views/insights/browser/webVitals/components/webVitalMeters';
import type {WebVitals} from 'sentry/views/insights/browser/webVitals/types';
import type {SectionKey} from 'sentry/views/issueDetails/streamline/context';
import {FoldSection} from 'sentry/views/issueDetails/streamline/foldSection';
import type {TraceTree} from 'sentry/views/performance/newTraceDetails/traceModels/traceTree';

const MIN_HEIGHT = 0;
const DEFAULT_HEIGHT = 100;
const MAX_HEIGHT = 700;

type Props = {
  rootEvent: UseApiQueryResult<EventTransaction, RequestError>;
  tree: TraceTree;
};

const ALLOWED_VITALS = ['lcp', 'fcp', 'cls', 'ttfb', 'inp'];

export function TraceContextPanel({tree, rootEvent}: Props) {
  const theme = useTheme();
  const [height, setHeight] = useState(DEFAULT_HEIGHT);
  const containerRef = useRef<HTMLDivElement>(null);

  const hasWebVitals = tree.vital_types.has('web');
  const hasValidWebVitals = useCallback(() => {
    return Array.from(tree.vitals.values()).some(vitalGroup =>
      vitalGroup.some(vital => ALLOWED_VITALS.includes(vital.key))
    );
  }, [tree]);

  const handleMouseDown = (event: React.MouseEvent) => {
    event.preventDefault();
    if (!containerRef.current) {
      return;
    }

    const startY = event.clientY;
    const startHeight = height;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      requestAnimationFrame(() => {
        if (!containerRef.current) {
          return;
        }

        const deltaY = moveEvent.clientY - startY;
        const newHeight = Math.max(
          MIN_HEIGHT,
          Math.min(startHeight - deltaY, MAX_HEIGHT)
        );
        containerRef.current.style.setProperty('--panel-height', `${newHeight}px`);
      });
    };

    const handleMouseUp = () => {
      if (!containerRef.current) {
        return;
      }

      const finalHeight = parseInt(
        getComputedStyle(containerRef.current).getPropertyValue('--panel-height'),
        10
      );
      setHeight(finalHeight);

      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };

  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.style.setProperty('--panel-height', `${height}px`);
    }
  }, [height]);

  const renderVitals = useCallback(() => {
    if (!hasWebVitals || !hasValidWebVitals()) {
      return null;
    }

    return ALLOWED_VITALS.map((webVital, index) => {
      let vital: TraceTree.CollectedVital | undefined;
      tree.vitals.forEach(entry => (vital = entry.find(v => v.key === webVital)));

      if (!vital || !vital.score) {
        return (
          <VitalMeter
            key={webVital}
            webVital={webVital as WebVitals}
            score={undefined}
            meterValue={undefined}
            color={theme.charts.getColorPalette(3)[index]}
            showTooltip
            isAggregateMode={false}
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
          isAggregateMode={false}
        />
      );
    });
  }, [tree, theme, hasWebVitals, hasValidWebVitals]);

  const renderTags = useCallback(() => {
    if (!rootEvent.data) {
      return null;
    }

    return (
      <EventTagsTree
        event={rootEvent.data}
        meta={rootEvent.data._meta}
        projectSlug={rootEvent.data.projectSlug ?? ''}
        tags={rootEvent.data.tags ?? []}
      />
    );
  }, [rootEvent.data]);

  return (
    <Container ref={containerRef}>
      <GrabberContainer onMouseDown={handleMouseDown}>
        <IconGrabbable color="gray500" />
      </GrabberContainer>

      <TraceContextContainer>
        <VitalMetersContainer>{renderVitals()}</VitalMetersContainer>
        <TraceTagsContainer>
          <FoldSection sectionKey={'trace_tags' as SectionKey} title={t('Trace Tags')}>
            {renderTags()}
          </FoldSection>
        </TraceTagsContainer>
      </TraceContextContainer>
    </Container>
  );
}

const TraceContextContainer = styled('div')`
  display: flex;
  flex-direction: column;
  align-items: center;
  width: 100%;
  margin-top: ${space(1)};
  height: var(--panel-height);
`;

const Container = styled('div')`
  width: 100%;
  display: flex;
  flex-direction: column;
  justify-content: center;
  --panel-height: ${DEFAULT_HEIGHT}px;

  &[style*='--panel-height: 0px'] {
    & ${TraceContextContainer} {
      display: none;
    }
  }
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

const VitalMetersContainer = styled('div')`
  justify-content: center;
  display: flex;
  flex-direction: row;
  gap: ${space(1)};
  width: 100%;
  margin-bottom: ${space(1)};
`;

const TraceTagsContainer = styled('div')`
  width: 100%;
  border: 1px solid ${p => p.theme.border};
  border-radius: ${p => p.theme.borderRadius};
  padding: 0 ${space(0.5)};
`;
