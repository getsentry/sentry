import {useEffect, useRef, useState} from 'react';
import {createPortal} from 'react-dom';
import styled from '@emotion/styled';

import {Button} from 'sentry/components/core/button';
import type {InsightSources} from 'sentry/components/events/autofix/types';
import {
  IconChat,
  IconCode,
  IconCommit,
  IconFatal,
  IconGlobe,
  IconList,
  IconProfiling,
  IconSpan,
  IconStack,
} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {defined} from 'sentry/utils';
import {MarkedText} from 'sentry/utils/marked/markedText';
import {SectionKey} from 'sentry/views/issueDetails/streamline/context';

interface AutofixInsightSourcesProps {
  codeUrls?: string[];
  sources?: InsightSources;
  title?: string;
}

// Helper to extract a meaningful name from a code URL
function getCodeSourceName(url: string): string {
  try {
    const urlObj = new URL(url);
    // Attempt to get the filename from the path
    const pathParts = urlObj.pathname.split('/');
    const filename = pathParts[pathParts.length - 1];

    // Extract line numbers if available in query parameters or hash
    let lineInfo = '';
    const searchParams = new URLSearchParams(urlObj.search);
    const hash = urlObj.hash;

    // Check common line number formats in query parameters (L, line, etc.)
    if (searchParams.has('L') || searchParams.has('line')) {
      const lineParam = searchParams.get('L') || searchParams.get('line');
      if (lineParam) {
        lineInfo = `:${lineParam}`;
      }
    }

    // Check for GitHub-style line numbers in hash (#L10 or #L10-L20)
    if (!lineInfo && hash) {
      const lineMatch = hash.match(/^#L(\d+)(?:-L(\d+))?$/);
      if (lineMatch) {
        lineInfo = lineMatch[2] ? `:${lineMatch[1]}-${lineMatch[2]}` : `:${lineMatch[1]}`;
      }
    }

    if (filename) {
      return filename + lineInfo;
    }
  } catch (e) {
    // Fallback if URL parsing fails or path is simple
  }
  // Fallback to a truncated version of the URL
  return url.length > 30 ? url.substring(0, 27) + '...' : url;
}

function AutofixInsightSources({sources, title, codeUrls}: AutofixInsightSourcesProps) {
  const [showThoughtsPopup, setShowThoughtsPopup] = useState(false);
  const overlayRef = useRef<HTMLDivElement>(null);
  const thoughtsButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (thoughtsButtonRef.current?.contains(event.target as Node)) {
        return;
      }

      if (overlayRef.current && !overlayRef.current.contains(event.target as Node)) {
        setShowThoughtsPopup(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [overlayRef, thoughtsButtonRef]);

  if (!sources && !codeUrls) {
    return null;
  }

  const sourceCards = [];

  // Stacktrace Card
  if (sources?.stacktrace_used) {
    sourceCards.push(
      <SourceCard
        key="stacktrace"
        onClick={() => {
          window.location.hash = '';
          window.location.hash = SectionKey.EXCEPTION;
        }}
        size="xs"
        icon={<IconStack size="xs" />}
      >
        {t('Stacktrace')}
      </SourceCard>
    );
  }

  // Breadcrumbs Card
  if (sources?.breadcrumbs_used) {
    sourceCards.push(
      <SourceCard
        key="breadcrumbs"
        onClick={() => {
          window.location.hash = '';
          window.location.hash = SectionKey.BREADCRUMBS;
        }}
        size="xs"
        icon={<IconList size="xs" />}
      >
        {t('Breadcrumbs')}
      </SourceCard>
    );
  }

  // HTTP Request Card
  if (sources?.http_request_used) {
    sourceCards.push(
      <SourceCard
        key="http-request"
        onClick={() => {
          window.location.hash = '';
          window.location.hash = SectionKey.REQUEST;
        }}
        size="xs"
        icon={<IconGlobe size="xs" />}
      >
        {t('HTTP Request')}
      </SourceCard>
    );
  }

  // Trace Event Cards
  sources?.trace_event_ids_used?.forEach(id => {
    sourceCards.push(
      <SourceCard
        key={`trace-${id}`}
        onClick={() => {
          if (sources?.event_trace_id) {
            window.open(
              `/issues/trace/${sources.event_trace_id}?node=txn-${id}`,
              '_blank'
            );
          }
        }}
        size="xs"
        icon={<IconSpan size="xs" />}
      >
        {t('Trace: %s', id.substring(0, 7))}
      </SourceCard>
    );
  });

  // Profile ID Cards
  sources?.profile_ids_used?.forEach(id => {
    sourceCards.push(
      <SourceCard
        key={`profile-${id}`}
        size="xs"
        icon={<IconProfiling size="xs" />}
        onClick={() =>
          window.open(`/explore/profiling/profile/${id}/flamegraph`, '_blank')
        }
      >
        {t('Profile: %s', id.substring(0, 7))}
      </SourceCard>
    );
  });

  // Connected Error ID Cards
  sources?.connected_error_ids_used?.forEach(id => {
    sourceCards.push(
      <SourceCard
        key={`error-${id}`}
        size="xs"
        onClick={() => {
          if (sources?.event_trace_id) {
            window.open(
              `/issues/trace/${sources.event_trace_id}?node=error-${id}`,
              '_blank'
            );
          }
        }}
        icon={<IconFatal size="xs" />}
      >
        {t('Error: %s', id.substring(0, 7))}
      </SourceCard>
    );
  });

  // Code URL Cards
  sources?.code_used_urls?.forEach((url, index) => {
    sourceCards.push(
      <SourceCard
        key={`code-${index}`}
        onClick={() => window.open(url, '_blank')}
        size="xs"
        icon={<IconCode size="xs" />}
      >
        {getCodeSourceName(url)}
      </SourceCard>
    );
  });

  if (codeUrls) {
    codeUrls.forEach((url, index) => {
      sourceCards.push(
        <SourceCard
          key={`passed-code-${index}`}
          onClick={() => window.open(url, '_blank')}
          size="xs"
          icon={<IconCode size="xs" />}
        >
          {getCodeSourceName(url)}
        </SourceCard>
      );
    });
  }

  // Diff URL Cards
  sources?.diff_urls?.forEach((url, index) => {
    sourceCards.push(
      <SourceCard
        key={`diff-${index}`}
        onClick={() => window.open(url, '_blank')}
        size="xs"
        icon={<IconCommit size="xs" />}
      >
        {t('Commit %s', getCodeSourceName(url))}
      </SourceCard>
    );
  });

  // Thoughts Card
  if (defined(sources?.thoughts) && sources?.thoughts.length > 0) {
    sourceCards.push(
      <SourceCard
        key="thoughts"
        ref={thoughtsButtonRef}
        onClick={() => {
          setShowThoughtsPopup(prev => !prev);
        }}
        size="xs"
        icon={<IconChat size="xs" />}
      >
        {t('Thoughts')}
      </SourceCard>
    );
  }

  if (sourceCards.length === 0) {
    return null;
  }

  return (
    <SourcesContainer>
      <CardsContainer aria-label="Autofix Insight Sources">{sourceCards}</CardsContainer>
      {showThoughtsPopup &&
        sources?.thoughts &&
        document.body &&
        createPortal(
          <ThoughtsOverlay
            ref={overlayRef}
            data-ignore-autofix-highlight="true"
            data-overlay="true"
          >
            <OverlayHeader>
              <OverlayTitle>{t("Seer's Thoughts")}</OverlayTitle>
              {title && <InsightTitle>"{title.trim()}"</InsightTitle>}
            </OverlayHeader>
            <OverlayContent>
              <MarkedText as="p" text={`...\n${sources.thoughts}\n...`} />
            </OverlayContent>
            <OverlayFooter>
              <OverlayButtonGroup>
                <Button onClick={() => setShowThoughtsPopup(false)}>{t('Close')}</Button>
              </OverlayButtonGroup>
            </OverlayFooter>
          </ThoughtsOverlay>,
          document.body
        )}
    </SourcesContainer>
  );
}

const SourcesContainer = styled('div')`
  margin-top: -${space(1)};
  padding-bottom: ${space(1)};
  width: 100%;
`;

const CardsContainer = styled('div')`
  display: flex;
  flex-wrap: wrap;
  gap: ${space(0.5)};
  width: 100%;
`;

const SourceCard = styled(Button)`
  display: flex;
  align-items: center;
  gap: ${space(0.5)};
  font-weight: ${p => p.theme.fontWeight.normal};

  white-space: nowrap;
  flex-shrink: 0;
`;

const ThoughtsOverlay = styled('div')`
  position: fixed;
  bottom: ${space(2)};
  left: 50%;
  right: ${space(2)};
  background: ${p => p.theme.backgroundElevated};
  border: 1px solid ${p => p.theme.border};
  border-radius: ${p => p.theme.borderRadius};
  box-shadow: ${p => p.theme.dropShadowHeavy};
  z-index: ${p => p.theme.zIndex.tooltip};
  display: flex;
  flex-direction: column;
  max-height: calc(100vh - 18rem);

  @media (max-width: ${p => p.theme.breakpoints.sm}) {
    left: ${space(2)};
  }
`;

const OverlayHeader = styled('div')`
  padding: ${space(2)} ${space(2)} 0;
  border-bottom: 1px solid ${p => p.theme.border};
`;

const OverlayContent = styled('div')`
  padding: ${space(2)};
  overflow-y: auto;
`;

const OverlayFooter = styled('div')`
  padding: ${space(1)};
  border-top: 1px solid ${p => p.theme.border};
`;

const OverlayButtonGroup = styled('div')`
  display: flex;
  justify-content: flex-end;
  gap: ${space(1)};
  font-family: ${p => p.theme.text.family};
`;

const OverlayTitle = styled('div')`
  font-weight: bold;
  color: ${p => p.theme.textColor};
  font-family: ${p => p.theme.text.family};
`;

const InsightTitle = styled('div')`
  padding-bottom: ${space(1)};
  color: ${p => p.theme.subText};
  font-family: ${p => p.theme.text.family};
`;

export default AutofixInsightSources;
