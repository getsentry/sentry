import type {ComponentType} from 'react';
import styled from '@emotion/styled';

import {Container} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import {displayRawContent as rawStacktraceContent} from 'sentry/components/events/interfaces/crashContent/stackTrace/rawContent';
import {FrameContent} from 'sentry/components/stackTrace/frame/frameContent';
import {StackTraceFrameRow} from 'sentry/components/stackTrace/frame/frameRow';
import {RawStackTraceText} from 'sentry/components/stackTrace/rawStackTrace';
import {
  useStackTraceContext,
  useStackTraceViewState,
} from 'sentry/components/stackTrace/stackTraceContext';
import {t} from 'sentry/locale';

import {NativeFrameHeader} from './frame/nativeFrameHeader';

interface NativeStackTraceFramesProps {
  /** Render absolute instruction address instead of relative offset. */
  absoluteAddresses?: boolean;
  /** Show the absolute file path instead of the basename. */
  absoluteFilePaths?: boolean;
  /** Removes the outer border, useful for embedding in hovercards. */
  borderless?: boolean;
  /** Replace the default trailing actions for each frame row. */
  frameActionsComponent?: ComponentType<{isHovering: boolean}>;
  /** Use rawFunction in place of the demangled function name. */
  fullFunctionName?: boolean;
}

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

export function NativeStackTraceFrames({
  absoluteAddresses,
  absoluteFilePaths,
  borderless = false,
  frameActionsComponent: FrameActionsComponent,
  fullFunctionName,
}: NativeStackTraceFramesProps) {
  const {rows, stacktrace, event} = useStackTraceContext();
  const {view} = useStackTraceViewState();

  if (view === 'raw') {
    return (
      <Container
        border={borderless ? undefined : 'primary'}
        radius={borderless ? undefined : 'md'}
      >
        <RawStackTraceText>
          {rawStacktraceContent({data: stacktrace, platform: event.platform})}
        </RawStackTraceText>
      </Container>
    );
  }

  if (rows.length === 0) {
    return (
      <Container border="primary" radius="md" padding="md">
        <Text variant="muted">{t('No stack trace available')}</Text>
      </Container>
    );
  }

  return (
    <FramesPanel borderless={borderless} data-test-id="native-stack-trace-content">
      {rows.map(row => {
        if (row.kind === 'omitted') {
          return (
            <OmittedFramesBanner key={row.rowKey} omittedFrames={row.omittedFrames} />
          );
        }

        return (
          <StackTraceFrameRow key={row.frameIndex} row={row}>
            <NativeFrameHeader
              absoluteAddresses={absoluteAddresses}
              absoluteFilePaths={absoluteFilePaths}
              fullFunctionName={fullFunctionName}
              actions={
                FrameActionsComponent
                  ? ({isHovering}) => <FrameActionsComponent isHovering={isHovering} />
                  : undefined
              }
            />
            <FrameContent />
          </StackTraceFrameRow>
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
  background: ${p => p.theme.colors.red100};
  padding: ${p => `${p.theme.space.sm} ${p.theme.space.md}`};
`;
