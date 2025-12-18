import {useEffect, useRef} from 'react';
import {css} from '@emotion/react';
import styled from '@emotion/styled';
import * as Sentry from '@sentry/react';
import {useWindowVirtualizer, type Virtualizer} from '@tanstack/react-virtual';

import {Flex} from 'sentry/components/core/layout';
import {ColorBar} from 'sentry/components/prevent/virtualRenderers/colorBar';
import {
  LINE_HEIGHT,
  type CoverageValue,
} from 'sentry/components/prevent/virtualRenderers/constants';
import {
  LineNumber,
  LineNumberColumn,
} from 'sentry/components/prevent/virtualRenderers/lineNumber';
import {ScrollBar} from 'sentry/components/prevent/virtualRenderers/scrollBar';
import {useCodeHighlighting} from 'sentry/components/prevent/virtualRenderers/useCodeHighlighter';
import {useDisablePointerEvents} from 'sentry/components/prevent/virtualRenderers/useDisablePointerEvents';
import {useIsOverflowing} from 'sentry/components/prevent/virtualRenderers/useIsOverflowing';
import {useSyncScrollMargin} from 'sentry/components/prevent/virtualRenderers/useSyncScrollMargin';
import {useSyncTotalWidth} from 'sentry/components/prevent/virtualRenderers/useSyncTotalWidth';
import {useSyncWrapperWidth} from 'sentry/components/prevent/virtualRenderers/useSyncWrapperWidth';
import {space} from 'sentry/styles/space';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
import type {SyntaxHighlightLine} from 'sentry/utils/usePrismTokens';
import {useScrollSync} from 'sentry/utils/useScrollSync';

export interface LineData {
  baseCoverage: CoverageValue | null;
  baseNumber: string | null;
  headCoverage: CoverageValue | null;
  headNumber: string | null;
}

interface CodeBodyProps {
  hashedPath: string;
  lineData: LineData[];
  lines: SyntaxHighlightLine[];
  setWrapperRefState: React.Dispatch<React.SetStateAction<HTMLDivElement | null>>;
  virtualizer: Virtualizer<Window, Element>;
  wrapperWidth: `${number}px` | '100%';
}

function CodeBody({
  lines,
  setWrapperRefState,
  virtualizer,
  wrapperWidth,
  hashedPath,
  lineData,
}: CodeBodyProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const initializeRenderer = useRef(true);

  useEffect(() => {
    if (!initializeRenderer.current) {
      return undefined;
    }
    initializeRenderer.current = false;

    const lineHash = location.hash.split('-')?.[0]?.slice(1);
    if (lineHash === hashedPath) {
      const lineIndicator = location.hash.split('-')?.[1];
      const isBase = lineIndicator?.includes('L');
      const isHead = lineIndicator?.includes('R');
      const hashLineNumber = lineIndicator?.slice(1);

      const index = lineData.findIndex(
        line =>
          (isHead && line.headNumber === hashLineNumber) ||
          (isBase && line.baseNumber === hashLineNumber)
      );

      if (index >= 0 && index < lines.length) {
        virtualizer.scrollToIndex(index, {align: 'start'});
      } else {
        Sentry.captureMessage(
          `Invalid line number in diff renderer hash: ${location.hash}`,
          {fingerprint: ['diff-renderer-invalid-line-number']}
        );
      }
    }

    return () => undefined;
  }, [hashedPath, lineData, lines.length, location.hash, virtualizer]);

  return (
    <Flex ref={setWrapperRefState}>
      <LineNumberColumn>
        {virtualizer.getVirtualItems().map(virtualItem => {
          const line = lineData[virtualItem.index];
          const lineNumber = line?.baseNumber;
          const hash = `#${hashedPath}-L${lineNumber}`;

          const isHighlighted = location.hash === hash;
          let label = 'base line';
          if (isHighlighted) {
            label = 'highlighted base line';
          } else if (line?.baseCoverage === 'H') {
            label = 'hit base line';
          } else if (line?.baseCoverage === 'M') {
            label = 'missed base line';
          } else if (line?.baseCoverage === 'P') {
            label = 'partial base line';
          }

          return (
            <LineNumber
              key={virtualItem.key}
              data-index={virtualItem.index}
              virtualizer={virtualizer}
              lineNumber={lineNumber}
              virtualItem={virtualItem}
              coverage={line?.baseCoverage ?? undefined}
              isHighlighted={isHighlighted}
              ariaLabel={label}
              onClick={() => {
                if (lineNumber) {
                  location.hash = location.hash === hash ? '' : hash;
                  navigate(location, {replace: true, preventScrollReset: true});
                }
              }}
            />
          );
        })}
      </LineNumberColumn>
      <LineNumberColumn>
        {virtualizer.getVirtualItems().map(virtualItem => {
          const line = lineData[virtualItem.index];
          const lineNumber = line?.headNumber;
          const hash = `#${hashedPath}-R${lineNumber}`;

          const isHighlighted = location.hash === hash;
          let label = 'head line';
          if (isHighlighted) {
            label = 'highlighted head line';
          } else if (line?.headCoverage === 'H') {
            label = 'hit head line';
          } else if (line?.headCoverage === 'M') {
            label = 'missed head line';
          } else if (line?.headCoverage === 'P') {
            label = 'partial head line';
          }

          return (
            <LineNumber
              key={virtualItem.key}
              data-index={virtualItem.index}
              virtualizer={virtualizer}
              lineNumber={lineNumber}
              virtualItem={virtualItem}
              coverage={line?.headCoverage ?? undefined}
              isHighlighted={isHighlighted}
              ariaLabel={label}
              onClick={() => {
                if (lineNumber) {
                  location.hash = location.hash === hash ? '' : hash;
                  navigate(location, {replace: true, preventScrollReset: true});
                }
              }}
            />
          );
        })}
      </LineNumberColumn>
      <CodeColumn inert>
        {virtualizer.getVirtualItems().map(virtualItem => {
          const line = lineData[virtualItem.index];
          const baseHash = `#${hashedPath}-L${line?.baseNumber}`;
          const headHash = `#${hashedPath}-R${line?.headNumber}`;

          return (
            <CodeLineOuterWrapper
              key={virtualItem.key}
              data-index={virtualItem.index}
              ref={virtualizer.measureElement}
              styleHeight={virtualItem.size}
              styleWidth={wrapperWidth}
              translateY={virtualItem.start - virtualizer.options.scrollMargin}
            >
              <ColorBar
                isHighlighted={location.hash === headHash || location.hash === baseHash}
              />
              <CodeLineInnerWrapper>
                {lines[virtualItem.index]?.map((value, index) => (
                  <span
                    key={index}
                    className={value.className}
                    style={{whiteSpace: 'pre'}}
                  >
                    {value.children}
                  </span>
                ))}
              </CodeLineInnerWrapper>
            </CodeLineOuterWrapper>
          );
        })}
      </CodeColumn>
    </Flex>
  );
}

const CodeColumn = styled('div')`
  height: 100%;
  width: 100%;
  pointer-events: none;
`;

const CodeLineOuterWrapper = styled('div')<{
  styleHeight: number;
  styleWidth: `${number}px` | '100%';
  translateY: number;
}>`
  position: absolute;
  top: 0;
  left: 0;
  width: ${p => p.styleWidth};
  padding-left: 192px;
  height: ${p => p.styleHeight}px;
  transform: translateY(${p => p.translateY}px);
  display: grid;
`;

const CodeLineInnerWrapper = styled('code')`
  height: ${LINE_HEIGHT}px;
  line-height: ${LINE_HEIGHT}px;
  grid-column-start: 1;
  grid-row-start: 1;
`;

interface VirtualDiffRendererProps {
  content: string;
  fileName: string;
  hashedPath: string;
  lineData: LineData[];
}

export function VirtualDiffRenderer({
  content,
  fileName,
  hashedPath,
  lineData,
}: VirtualDiffRendererProps) {
  const widthDivRef = useRef<HTMLPreElement>(null);
  const codeDisplayOverlayRef = useRef<HTMLDivElement>(null);
  const textAreaRef = useRef<HTMLTextAreaElement>(null);
  const scrollBarRef = useRef<HTMLDivElement>(null);
  const virtualCodeRendererRef = useRef<HTMLDivElement>(null);
  const {wrapperWidth, setWrapperRefState} = useSyncWrapperWidth();

  const {language, lines} = useCodeHighlighting(content, fileName);

  const scrollMargin = useSyncScrollMargin(codeDisplayOverlayRef);

  const virtualizer = useWindowVirtualizer({
    count: lines.length,
    scrollMargin: scrollMargin ?? 0,
    overscan: 60,
    estimateSize: () => LINE_HEIGHT,
  });

  // disable pointer events while scrolling
  useDisablePointerEvents(virtualCodeRendererRef);

  // sync the width of the textarea with the pushing widthDiv
  useSyncTotalWidth(textAreaRef, widthDivRef);

  // check if the code display overlay is overflowing, so we can conditionally render the scroll bar
  const isOverflowing = useIsOverflowing(codeDisplayOverlayRef);

  // sync text area scrolling with the code display overlay and scroll bar
  useScrollSync({
    direction: 'left',
    scrollingRef: textAreaRef,
    refsToSync: [codeDisplayOverlayRef, scrollBarRef],
  });

  // sync scroll bar scrolling with the code display overlay and text area
  useScrollSync({
    direction: 'left',
    scrollingRef: scrollBarRef,
    refsToSync: [codeDisplayOverlayRef, textAreaRef],
  });

  return (
    <VirtualCodeRenderer
      ref={virtualCodeRendererRef}
      data-test-id="virtual-diff-renderer"
    >
      <TextArea
        ref={textAreaRef}
        value={content}
        // need to set to true since we're setting a value without an onChange handler
        readOnly
        // disable all the things for text area's so it doesn't interfere with the code display element
        autoCapitalize="false"
        autoCorrect="false"
        spellCheck="false"
        inputMode="none"
        aria-readonly="true"
        tabIndex={0}
        aria-multiline="true"
        aria-haspopup="false"
        data-test-id="virtual-diff-renderer-text-area"
      />
      <CodeDisplayOverlay
        ref={codeDisplayOverlayRef}
        styleHeight={virtualizer.getTotalSize()}
        data-test-id="virtual-diff-renderer-overlay"
      >
        <CodePreWrapper
          ref={widthDivRef}
          isOverflowing={isOverflowing}
          className={`language-${language}`}
          // Need to style here as they get overridden if set in the styled component
          style={{
            padding: 0,
            borderTopLeftRadius: '0px',
            borderTopRightRadius: '0px',
            borderBottomLeftRadius: isOverflowing ? '0px' : space(0.75),
            borderBottomRightRadius: isOverflowing ? '0px' : space(0.75),
          }}
        >
          <CodeBody
            setWrapperRefState={setWrapperRefState}
            wrapperWidth={wrapperWidth}
            lines={lines}
            lineData={lineData}
            virtualizer={virtualizer}
            hashedPath={hashedPath}
          />
        </CodePreWrapper>
      </CodeDisplayOverlay>
      {isOverflowing ? (
        <ScrollBar scrollBarRef={scrollBarRef} wrapperWidth={wrapperWidth} />
      ) : null}
    </VirtualCodeRenderer>
  );
}

const VirtualCodeRenderer = styled('div')`
  tab-size: 8;
  position: relative;
  width: 100%;
  overflow-x: auto;
`;

const TextArea = styled('textarea')`
  tab-size: 8;
  overscroll-behavior-x: none;
  line-height: ${LINE_HEIGHT}px;
  scrollbar-width: none;
  position: absolute;
  padding-left: 192px;
  z-index: 1;
  width: 100%;
  height: 100%;
  resize: none;
  overflow-y: hidden;
  white-space: pre;
  background-color: unset;
  color: transparent;
  outline: 0px solid transparent;
  outline-offset: 0px;
  font-family: ${p => p.theme.text.familyMono};
  font-size: ${p => p.theme.fontSize.sm};
  padding-top: 0;
  padding-bottom: 0;
  padding-right: 0;
  border: 0;
`;

const CodeDisplayOverlay = styled('div')<{styleHeight: number}>`
  overflow-y: hidden;
  white-space: pre;
  overflow-x: overlay;
  scrollbar-width: none;
  position: relative;
  height: ${p => p.styleHeight + 2}px;
`;

const CodePreWrapper = styled('pre')<{isOverflowing: boolean}>`
  width: 100%;
  height: 100%;
  scrollbar-width: none;

  border-left: ${space(0.25)} solid ${p => p.theme.colors.gray200};
  border-right: ${space(0.25)} solid ${p => p.theme.colors.gray200};

  ${p => {
    if (!p.isOverflowing) {
      return css`
        border-bottom: ${space(0.25)} solid ${p.theme.colors.gray200};
      `;
    }
    return '';
  }}
`;
