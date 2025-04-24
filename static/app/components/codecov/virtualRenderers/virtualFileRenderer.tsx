import {useEffect, useRef} from 'react';
import styled from '@emotion/styled';
import * as Sentry from '@sentry/react';
import {useWindowVirtualizer, type Virtualizer} from '@tanstack/react-virtual';

import {ColorBar} from 'sentry/components/codecov/virtualRenderers/colorBar';
import {
  type CoverageMap,
  LINE_HEIGHT,
} from 'sentry/components/codecov/virtualRenderers/constants';
import {
  LineNumber,
  LineNumberColumn,
} from 'sentry/components/codecov/virtualRenderers/lineNumber';
import {ScrollBar} from 'sentry/components/codecov/virtualRenderers/scrollBar';
import {useCodeHighlighting} from 'sentry/components/codecov/virtualRenderers/useCodeHighlighter';
import {useDisablePointerEvents} from 'sentry/components/codecov/virtualRenderers/useDisablePointerEvents';
import {useIsOverflowing} from 'sentry/components/codecov/virtualRenderers/useIsOverflowing';
import {useSyncScrollMargin} from 'sentry/components/codecov/virtualRenderers/useSyncScrollMargin';
import {useSyncTotalWidth} from 'sentry/components/codecov/virtualRenderers/useSyncTotalWidth';
import {useSyncWrapperWidth} from 'sentry/components/codecov/virtualRenderers/useSyncWrapperWidth';
import {space} from 'sentry/styles/space';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
import type {SyntaxHighlightLine} from 'sentry/utils/usePrismTokens';
import {useScrollSync} from 'sentry/utils/useScrollSync';

interface CodeBodyProps {
  coverage: CoverageMap;
  lines: SyntaxHighlightLine[];
  setWrapperRefState: React.Dispatch<React.SetStateAction<HTMLDivElement | null>>;
  virtualizer: Virtualizer<Window, Element>;
  wrapperWidth: `${number}px` | '100%';
}

function CodeBody({
  coverage,
  lines,
  setWrapperRefState,
  virtualizer,
  wrapperWidth,
}: CodeBodyProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const initializeRenderer = useRef(true);

  useEffect(() => {
    if (!initializeRenderer.current) {
      return undefined;
    }
    initializeRenderer.current = false;

    const locationHash = location.hash;
    const lineNumber = parseInt(locationHash.slice(2), 10);
    if (!isNaN(lineNumber) && lineNumber > 0 && lineNumber <= lines.length) {
      virtualizer.scrollToIndex(lineNumber - 1, {align: 'start'});
    } else if (locationHash) {
      Sentry.captureMessage(
        `Invalid line number in file renderer hash: ${locationHash}`,
        {fingerprint: ['file-renderer-invalid-line-number']}
      );
    }

    return () => undefined;
  }, [virtualizer, location.hash, lines.length]);

  return (
    <CodeWrapper ref={setWrapperRefState}>
      <LineNumberColumn>
        {virtualizer.getVirtualItems().map(virtualItem => {
          const lineNumber = virtualItem.index + 1;

          return (
            <LineNumber
              key={virtualItem.key}
              coverage={coverage.get(lineNumber)?.coverage}
              lineNumber={lineNumber}
              virtualItem={virtualItem}
              virtualizer={virtualizer}
              isHighlighted={location.hash === `#L${lineNumber}`}
              onClick={() => {
                location.hash =
                  location.hash === `#L${lineNumber}` ? '' : `#L${lineNumber}`;
                navigate(location, {replace: true, preventScrollReset: true});
              }}
            />
          );
        })}
      </LineNumberColumn>
      <CodeColumn inert>
        {virtualizer.getVirtualItems().map(virtualItem => {
          const lineNumber = virtualItem.index + 1;
          return (
            <CodeLineOuterWrapper
              key={virtualItem.key}
              data-index={virtualItem.index}
              ref={virtualizer.measureElement}
              styleHeight={virtualItem.size}
              styleWidth={wrapperWidth}
              translateY={virtualItem.start - virtualizer.options.scrollMargin}
            >
              {location.hash === `#L${lineNumber}` ? (
                <ColorBar isHighlighted={location.hash === `#L${lineNumber}`} />
              ) : null}
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
    </CodeWrapper>
  );
}

const CodeWrapper = styled('div')`
  display: flex;
  flex: 1 1 0%;
`;

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
  padding-left: 94px;
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

interface VirtualFileRendererProps {
  content: string;
  coverage: CoverageMap;
  fileName: string;
}

export function VirtualFileRenderer({
  content,
  coverage,
  fileName,
}: VirtualFileRendererProps) {
  const widthDivRef = useRef<HTMLPreElement>(null);
  const textAreaRef = useRef<HTMLTextAreaElement>(null);
  const scrollBarRef = useRef<HTMLDivElement>(null);
  const codeDisplayOverlayRef = useRef<HTMLDivElement>(null);
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
    <VirtualCodeRenderer ref={virtualCodeRendererRef}>
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
      />
      <CodeDisplayOverlay
        ref={codeDisplayOverlayRef}
        styleHeight={virtualizer.getTotalSize()}
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
            coverage={coverage}
            lines={lines}
            virtualizer={virtualizer}
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
  padding-left: 94px;
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
  font-size: ${p => p.theme.codeFontSize};
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
  border-left: ${space(0.25)} solid ${p => p.theme.gray200};
  border-right: ${space(0.25)} solid ${p => p.theme.gray200};
  border-bottom: ${space(0.25)} solid ${p => p.theme.gray200};
`;

const CodePreWrapper = styled('pre')<{isOverflowing: boolean}>`
  width: 100%;
  height: 100%;
  scrollbar-width: none;
`;
