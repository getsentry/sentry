import styled from '@emotion/styled';

import {Container} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import rawStacktraceContent from 'sentry/components/events/interfaces/crashContent/stackTrace/rawContent';
import Panel from 'sentry/components/panels/panel';
import {t} from 'sentry/locale';

import {StackTraceFrameRow} from './frame/frameRow';
import {useStackTraceContext, useStackTraceViewState} from './stackTraceContext';

function OmittedFramesBanner({omittedFrames}: {omittedFrames: [number, number]}) {
  const [start, end] = omittedFrames;
  return (
    <OmittedRow>
      <Text size="xs" variant="muted">
        {t('Frames %d to %d were omitted and not available.', start, end)}
      </Text>
    </OmittedRow>
  );
}

export function StackTraceFrames() {
  const {rows, stacktrace, event} = useStackTraceContext();
  const {view} = useStackTraceViewState();

  if (view === 'raw') {
    return (
      <Panel>
        <RawStackTraceText>
          {rawStacktraceContent({data: stacktrace, platform: event.platform})}
        </RawStackTraceText>
      </Panel>
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
    <FramesPanel>
      <div>
        {rows.map(row => {
          if (row.kind === 'omitted') {
            return (
              <OmittedFramesBanner key={row.rowKey} omittedFrames={row.omittedFrames} />
            );
          }

          return <StackTraceFrameRow key={row.frameIndex} row={row} />;
        })}
      </div>
    </FramesPanel>
  );
}

const FramesPanel = styled(Panel)`
  overflow: hidden;
`;

const OmittedRow = styled(Container)`
  border-left: 2px solid ${p => p.theme.colors.red400};
  border-top: 1px solid ${p => p.theme.tokens.border.primary};
  background: ${p => p.theme.colors.red100};
  padding: ${p => `${p.theme.space.sm} ${p.theme.space.md}`};
`;

const RawStackTraceText = styled('pre')`
  margin: 0;
  padding: ${p => p.theme.space.md};
  overflow: auto;
  font-size: ${p => p.theme.font.size.sm};
`;
