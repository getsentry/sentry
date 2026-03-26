import {Activity, useMemo, useRef, type ComponentType} from 'react';
import styled from '@emotion/styled';

import {Container} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import {displayRawContent as rawStacktraceContent} from 'sentry/components/events/interfaces/crashContent/stackTrace/rawContent';
import {t} from 'sentry/locale';

import {StackTraceFrameRow} from './frame/frameRow';
import {RawStackTraceText} from './rawStackTrace';
import {useStackTraceContext, useStackTraceViewState} from './stackTraceContext';

function OmittedFramesBanner({omittedFrames}: {omittedFrames: [number, number]}) {
  const [start, end] = omittedFrames;
  return (
    <OmittedRow>
      <Text size="xs" variant="danger">
        {t('Frames %d to %d were omitted and not available.', start, end)}
      </Text>
    </OmittedRow>
  );
}

interface StackTraceFramesProps {
  frameContextComponent: ComponentType;
  /** Removes the outer border and border-radius, useful for embedding in hovercards. */
  borderless?: boolean;
  frameActionsComponent?: ComponentType<{isHovering: boolean}>;
}

export function StackTraceFrames({
  borderless = false,
  frameContextComponent: FrameContextComponent,
  frameActionsComponent: FrameActionsComponent = StackTraceFrameRow.Actions.Default,
}: StackTraceFramesProps) {
  const {rows, allRows, stacktrace, event} = useStackTraceContext();
  const {view} = useStackTraceViewState();

  // Visible frame indices + current row data from a single pass over rows
  const {visibleIndices, rowByIndex} = useMemo(() => {
    const indices = new Set<number>();
    const map = new Map<number, (typeof rows)[number] & {kind: 'frame'}>();
    for (const row of rows) {
      if (row.kind === 'frame') {
        indices.add(row.frameIndex);
        map.set(row.frameIndex, row);
      }
    }
    return {visibleIndices: indices, rowByIndex: map};
  }, [rows]);

  // Lazy: track frames that have ever been visible so we only mount on first appearance.
  // A ref is sufficient — the component already re-renders when `rows` changes.
  const everVisibleRef = useRef(new Set<number>());
  for (const idx of visibleIndices) {
    everVisibleRef.current.add(idx);
  }

  if (view === 'raw') {
    return (
      <Container border="primary" radius="md">
        <RawStackTraceText>
          {rawStacktraceContent({data: stacktrace, platform: event.platform})}
        </RawStackTraceText>
      </Container>
    );
  }

  if (allRows.length === 0) {
    return (
      <Container border="primary" radius="md" padding="md">
        <Text variant="muted">{t('No stack trace available')}</Text>
      </Container>
    );
  }

  return (
    <FramesPanel borderless={borderless}>
      {allRows.map(row => {
        if (row.kind === 'omitted') {
          return (
            <OmittedFramesBanner key={row.rowKey} omittedFrames={row.omittedFrames} />
          );
        }

        if (!everVisibleRef.current.has(row.frameIndex)) {
          return null;
        }

        const isVisible = visibleIndices.has(row.frameIndex);
        const activeRow = rowByIndex.get(row.frameIndex) ?? row;

        return (
          <Activity key={row.frameIndex} mode={isVisible ? 'visible' : 'hidden'}>
            <StackTraceFrameRow row={activeRow}>
              <StackTraceFrameRow.Header
                actions={({isHovering}) => (
                  <FrameActionsComponent isHovering={isHovering} />
                )}
              />
              <FrameContextComponent />
            </StackTraceFrameRow>
          </Activity>
        );
      })}
    </FramesPanel>
  );
}

const FramesPanel = styled('div')<{borderless: boolean}>`
  overflow: hidden;
  border: ${p => (p.borderless ? 'none' : `1px solid ${p.theme.tokens.border.primary}`)};
  border-radius: ${p => (p.borderless ? '0' : p.theme.radius.md)};

  > * + * {
    border-top: 1px solid ${p => p.theme.tokens.border.primary};
  }
`;

const OmittedRow = styled('div')`
  border-left: 2px solid ${p => p.theme.colors.red400};
  border-top: 1px solid ${p => p.theme.tokens.border.primary};
  background: ${p => p.theme.colors.red100};
  padding: ${p => `${p.theme.space.sm} ${p.theme.space.md}`};
`;
