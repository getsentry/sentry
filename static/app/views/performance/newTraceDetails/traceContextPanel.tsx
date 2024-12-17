import {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import styled from '@emotion/styled';

import EventTagsTree from 'sentry/components/events/eventTags/eventTagsTree';
import {IconGrabbable} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {EventTransaction} from 'sentry/types/event';
import type {UseApiQueryResult} from 'sentry/utils/queryClient';
import type RequestError from 'sentry/utils/requestError/requestError';
import type {SectionKey} from 'sentry/views/issueDetails/streamline/context';
import {FoldSection} from 'sentry/views/issueDetails/streamline/foldSection';
import {TraceContextVitals} from 'sentry/views/performance/newTraceDetails/traceContextVitals';
import type {TraceTree} from 'sentry/views/performance/newTraceDetails/traceModels/traceTree';
import {
  DEFAULT_TRACE_VIEW_PREFERENCES,
  loadTraceViewPreferences,
} from 'sentry/views/performance/newTraceDetails/traceState/tracePreferences';
import {useTraceStateDispatch} from 'sentry/views/performance/newTraceDetails/traceState/traceStateProvider';

const MIN_HEIGHT = 0;
const DEFAULT_HEIGHT = 150;
const MAX_HEIGHT = 700;

type Props = {
  rootEvent: UseApiQueryResult<EventTransaction, RequestError>;
  tree: TraceTree;
};

export function TraceContextPanel({tree, rootEvent}: Props) {
  const [height, setHeight] = useState(DEFAULT_HEIGHT);
  const containerRef = useRef<HTMLDivElement>(null);
  const traceDispatch = useTraceStateDispatch();

  const preferences = useMemo(
    () =>
      loadTraceViewPreferences('trace-view-preferences') ||
      DEFAULT_TRACE_VIEW_PREFERENCES,
    []
  );

  useEffect(() => {
    const loadedHeight = preferences.drawer.sizes['trace context height'];

    if (containerRef.current && loadedHeight !== undefined) {
      setHeight(loadedHeight);
      containerRef.current.style.setProperty('--panel-height', `${loadedHeight}px`);
    }
  }, [preferences.drawer.sizes, containerRef]);

  const handleMouseDown = useCallback(
    (event: React.MouseEvent) => {
      event.preventDefault();

      if (!containerRef.current) {
        return;
      }

      const startY = event.clientY;
      const startHeight = height;

      function handleMouseMove(moveEvent: MouseEvent) {
        if (!containerRef.current) {
          return;
        }

        const deltaY = moveEvent.clientY - startY;
        const newHeight = Math.max(
          MIN_HEIGHT,
          Math.min(startHeight - deltaY, MAX_HEIGHT)
        );

        containerRef.current.style.setProperty('--panel-height', `${newHeight}px`);
      }

      function handleMouseUp() {
        if (!containerRef.current) {
          return;
        }

        const finalHeight = parseInt(
          getComputedStyle(containerRef.current).getPropertyValue('--panel-height'),
          10
        );

        setHeight(finalHeight);
        traceDispatch({type: 'set trace context height', payload: finalHeight});

        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
      }

      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    },
    [height, traceDispatch]
  );

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
    <Container>
      <GrabberContainer onMouseDown={handleMouseDown}>
        <IconGrabbable color="gray500" />
      </GrabberContainer>

      <TraceContextContainer ref={containerRef}>
        <VitalMetersContainer>
          <TraceContextVitals tree={tree} />
        </VitalMetersContainer>
        <TraceTagsContainer>
          <FoldSection sectionKey={'trace_tags' as SectionKey} title={t('Trace Tags')}>
            {renderTags()}
          </FoldSection>
        </TraceTagsContainer>
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

const TraceContextContainer = styled('div')`
  display: flex;
  flex-direction: column;
  align-items: center;
  width: 100%;
  margin-top: ${space(1)};
  --panel-height: ${DEFAULT_HEIGHT}px;
  height: var(--panel-height);

  &[style*='--panel-height: 0px'] {
    display: none;
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
  display: flex;
  justify-content: space-between;
  flex-direction: row;
  gap: ${space(1)};
  width: 100%;
  margin-bottom: ${space(1)};
`;

const TraceTagsContainer = styled('div')`
  background-color: ${p => p.theme.background};
  width: 100%;
  border: 1px solid ${p => p.theme.border};
  border-radius: ${p => p.theme.borderRadius};
  padding: 0 ${space(0.5)};
`;
