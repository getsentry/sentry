import {Activity, useRef} from 'react';
import {css} from '@emotion/react';
import styled from '@emotion/styled';

import {Container, Grid} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';
import {Tooltip} from '@sentry/scraps/tooltip';

import {Assembly} from 'sentry/components/events/interfaces/frame/assembly';
import {FrameRegisters} from 'sentry/components/events/interfaces/frame/frameRegisters';
import {usePrismTokensSourceContext} from 'sentry/components/events/interfaces/frame/usePrismTokensSourceContext';
import {
  hasAssembly,
  hasContextRegisters,
} from 'sentry/components/events/interfaces/frame/utils';
import {parseAssembly} from 'sentry/components/events/interfaces/utils';
import {FrameVariablesGrid} from 'sentry/components/stackTrace/frame/frameVariablesGrid';
import {
  useStackTraceContext,
  useStackTraceFrameContext,
} from 'sentry/components/stackTrace/stackTraceContext';
import {t} from 'sentry/locale';
import {Coverage} from 'sentry/types/integrations';
import {getFileExtension} from 'sentry/utils/fileExtension';

const COVERAGE_TEXT: Record<Coverage, string | undefined> = {
  [Coverage.NOT_COVERED]: t('Line uncovered by tests'),
  [Coverage.COVERED]: t('Line covered by tests'),
  [Coverage.PARTIAL]: t('Line partially covered by tests'),
  [Coverage.NOT_APPLICABLE]: undefined,
};

interface FrameContentProps {
  sourceLineCoverage?: Array<Coverage | undefined>;
}

export function FrameContent({sourceLineCoverage = []}: FrameContentProps) {
  const {event, frame, frameContextId, frameIndex, isExpanded, platform} =
    useStackTraceFrameContext();
  const {frames, lastFrameIndex, meta, stacktrace} = useStackTraceContext();

  // Lazy: don't mount until first expanded, then preserve via Activity.
  // A ref is sufficient — the re-render is already triggered by isExpanded changing.
  const hasBeenExpandedRef = useRef(isExpanded);
  if (isExpanded) {
    hasBeenExpandedRef.current = true;
  }

  const contextLines = isExpanded ? (frame.context ?? []) : [];
  const maxLineNumber = contextLines.reduce(
    (max, [lineNo]) => Math.max(max, lineNo ?? 0),
    0
  );
  const lineNumberDigits = String(maxLineNumber).length;
  const fileExtension = isExpanded ? (getFileExtension(frame.filename ?? '') ?? '') : '';
  const prismLines = usePrismTokensSourceContext({
    contextLines,
    lineNo: frame.lineNo,
    fileExtension,
  });
  const frameRegisters = frameIndex === frames.length - 1 ? stacktrace.registers : null;
  const expandedFrameRegisters =
    frameRegisters && hasContextRegisters(frameRegisters) ? frameRegisters : null;
  const frameVariables = frame.vars;
  const hasFrameAssembly = hasAssembly(frame, platform);
  const hasSourceContext = contextLines.length > 0;
  const hasFrameVariables = !!frameVariables && Object.keys(frameVariables).length > 0;
  const hasFrameRegisters = !!expandedFrameRegisters;
  const hasAnyFrameDetails =
    hasSourceContext || hasFrameVariables || hasFrameRegisters || hasFrameAssembly;
  const shouldShowNoDetails =
    frameIndex === lastFrameIndex && frameIndex === 0 && !hasAnyFrameDetails;

  if (!hasBeenExpandedRef.current) {
    return null;
  }

  return (
    <Activity mode={isExpanded ? 'visible' : 'hidden'}>
      <Container
        id={frameContextId}
        background="primary"
        overflowX="hidden"
        data-test-id="core-stacktrace-frame-context"
      >
        {hasSourceContext ? (
          <FrameSourceGrid>
            {contextLines.map(([lineNumber, lineValue], lineIndex) => (
              <FrameSourceRow
                key={`${lineNumber}-${lineIndex}`}
                isActive={lineNumber === frame.lineNo}
                lineNumberDigits={lineNumberDigits}
              >
                <Tooltip
                  skipWrapper
                  title={
                    COVERAGE_TEXT[
                      sourceLineCoverage[lineIndex] ?? Coverage.NOT_APPLICABLE
                    ]
                  }
                >
                  <FrameSourceLineNumber
                    aria-label={`Line ${lineNumber}`}
                    isActive={lineNumber === frame.lineNo}
                    coverage={sourceLineCoverage[lineIndex] ?? Coverage.NOT_APPLICABLE}
                  >
                    {lineNumber}
                  </FrameSourceLineNumber>
                </Tooltip>
                <FrameSourceCode
                  className={fileExtension ? `language-${fileExtension}` : undefined}
                >
                  {(
                    prismLines[lineIndex] ?? [
                      {children: lineValue ?? '', className: 'token'},
                    ]
                  ).map((token, tokenIndex) => (
                    <span key={tokenIndex} className={token.className}>
                      {token.children}
                    </span>
                  ))}
                </FrameSourceCode>
              </FrameSourceRow>
            ))}
          </FrameSourceGrid>
        ) : shouldShowNoDetails ? (
          <Container padding="sm md">
            <Text size="xs" variant="muted">
              {t('No additional details are available for this frame.')}
            </Text>
          </Container>
        ) : null}
        {hasFrameVariables ? (
          <FrameVariablesGrid
            platform={platform}
            data={frameVariables}
            meta={meta?.frames?.[frameIndex]?.vars}
          />
        ) : null}
        {hasFrameRegisters ? (
          <Container borderTop="primary">
            <FrameRegisters
              registers={expandedFrameRegisters}
              meta={meta?.registers}
              deviceArch={event.contexts?.device?.arch}
            />
          </Container>
        ) : null}
        {hasFrameAssembly ? (
          <Container borderTop="primary">
            <Assembly {...parseAssembly(frame.package ?? null)} />
          </Container>
        ) : null}
      </Container>
    </Activity>
  );
}

const FrameSourceGrid = styled('div')`
  display: grid;
  width: 100%;
  min-width: 0;
`;

const FrameSourceRow = styled(Grid)<{isActive: boolean; lineNumberDigits: number}>`
  grid-template-columns:
    calc(${p => Math.max(p.lineNumberDigits, 3) + 1}ch)
    1fr;
  align-items: start;
  min-width: 0;
  background: ${p => (p.isActive ? p.theme.tokens.background.secondary : 'transparent')};
`;

const FrameSourceLineNumber = styled('div')<{
  coverage: Coverage;
  isActive: boolean;
}>`
  display: flex;
  align-items: center;
  justify-content: flex-end;
  min-height: 1.8em;
  font-family: ${p => p.theme.font.family.mono};
  font-size: ${p => p.theme.font.size.sm};
  color: ${p => p.theme.tokens.content.secondary};
  line-height: 1.8;
  text-align: right;
  user-select: none;
  padding-left: ${p => p.theme.space.xs};
  padding-right: ${p => p.theme.space.xs};
  border-right: 3px solid transparent;

  ${p =>
    p.coverage === Coverage.COVERED &&
    css`
      background: ${p.theme.colors.green100};
      border-right-color: ${p.theme.tokens.border.success.vibrant};
    `}

  ${p =>
    p.coverage === Coverage.NOT_COVERED &&
    css`
      background: ${p.theme.colors.red100};
      border-right-color: ${p.theme.tokens.border.danger.vibrant};
    `}

  ${p =>
    p.coverage === Coverage.PARTIAL &&
    css`
      background: ${p.theme.colors.yellow100};
      border-right-style: dashed;
      border-right-color: ${p.theme.tokens.border.warning.vibrant};
    `}

  ${p =>
    p.isActive &&
    p.coverage === Coverage.PARTIAL &&
    css`
      background: ${p.theme.colors.yellow200};
    `}

  ${p =>
    p.isActive &&
    p.coverage === Coverage.COVERED &&
    css`
      background: ${p.theme.colors.green200};
    `}

  ${p =>
    p.isActive &&
    p.coverage === Coverage.NOT_COVERED &&
    css`
      background: ${p.theme.colors.red200};
    `}
`;

const FrameSourceCode = styled('code')`
  color: ${p => p.theme.tokens.content.primary};
  font-family: ${p => p.theme.font.family.mono};
  font-size: ${p => p.theme.font.size.sm};
  line-height: 1.8;
  display: block;
  min-width: 0;
  background: transparent;
  padding: 0;
  border-radius: 0;

  && {
    white-space: pre-wrap;
    overflow-wrap: anywhere;
    word-break: break-word;
    background: transparent;
  }
`;
