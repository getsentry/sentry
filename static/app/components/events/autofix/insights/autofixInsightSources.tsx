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
import {ellipsize} from 'sentry/utils/string/ellipsize';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
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
  return ellipsize(url, 30);
}

// Helper to extract commit SHA from a commit URL and truncate to 7 characters
function getCommitSha(url: string): string {
  try {
    const urlObj = new URL(url);
    const pathParts = urlObj.pathname.split('/');

    // Look for common commit URL patterns
    // GitHub: /user/repo/commit/SHA
    // GitLab: /user/repo/-/commit/SHA
    // Bitbucket: /user/repo/commits/SHA
    const commitIndex = pathParts.findIndex(
      part => part === 'commit' || part === 'commits'
    );

    if (commitIndex !== -1 && commitIndex < pathParts.length - 1) {
      const sha = pathParts[commitIndex + 1];
      // Truncate to first 7 characters
      if (sha) {
        return sha.substring(0, 7);
      }
    }

    // Fallback: use the last part of the path
    const lastPart = pathParts[pathParts.length - 1];
    return lastPart ? lastPart.substring(0, 7) : ellipsize(url, 7);
  } catch (e) {
    // Fallback if URL parsing fails
    return ellipsize(url, 7);
  }
}

function AutofixInsightSources({sources, title, codeUrls}: AutofixInsightSourcesProps) {
  const [showThoughtsPopup, setShowThoughtsPopup] = useState(false);
  const overlayRef = useRef<HTMLDivElement>(null);
  const thoughtsButtonRef = useRef<HTMLButtonElement>(null);
  const navigate = useNavigate();
  const location = useLocation();

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

  // Generate source cards using the reusable function
  const sourceCardData = generateSourceCards(sources, codeUrls, {location, navigate});

  // Convert to JSX elements
  const sourceCards = sourceCardData.map(sourceCard => (
    <SourceCard
      key={sourceCard.key}
      onClick={sourceCard.onClick}
      size="xs"
      icon={sourceCard.icon}
      priority={sourceCard.isPrimary ? 'primary' : 'default'}
    >
      {sourceCard.label}
    </SourceCard>
  ));

  // Add thoughts card separately since it needs special handling (ref and popup)
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

export const SourceCard = styled(Button)<{isHighlighted?: boolean}>`
  display: flex;
  align-items: center;
  gap: ${space(0.5)};
  font-weight: ${p => p.theme.fontWeight.normal};
  color: ${p =>
    p.isHighlighted
      ? p.theme.button.primary.colorActive
      : p.theme.tokens.content.secondary};
  white-space: nowrap;
  flex-shrink: 0;
`;

const ThoughtsOverlay = styled('div')`
  position: fixed;
  bottom: ${space(2)};
  left: 50%;
  right: ${space(2)};
  background: ${p => p.theme.tokens.background.primary};
  border: 1px solid ${p => p.theme.tokens.border.primary};
  border-radius: ${p => p.theme.radius.md};
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
  border-bottom: 1px solid ${p => p.theme.tokens.border.primary};
`;

const OverlayContent = styled('div')`
  padding: ${space(2)};
  overflow-y: auto;
`;

const OverlayFooter = styled('div')`
  padding: ${space(1)};
  border-top: 1px solid ${p => p.theme.tokens.border.primary};
`;

const OverlayButtonGroup = styled('div')`
  display: flex;
  justify-content: flex-end;
  gap: ${space(1)};
  font-family: ${p => p.theme.text.family};
`;

const OverlayTitle = styled('div')`
  font-weight: bold;
  color: ${p => p.theme.tokens.content.primary};
  font-family: ${p => p.theme.text.family};
`;

const InsightTitle = styled('div')`
  padding-bottom: ${space(1)};
  color: ${p => p.theme.tokens.content.secondary};
  font-family: ${p => p.theme.text.family};
`;

export function generateSourceCards(
  sources?: InsightSources,
  codeUrls?: string[],
  options?: {
    isPrimary?: boolean;
    location?: ReturnType<typeof useLocation>;
    navigate?: ReturnType<typeof useNavigate>;
  }
) {
  if (!sources && !codeUrls) {
    return [];
  }

  const sourceCards = [];
  const {isPrimary = false, location, navigate} = options || {};

  // Stacktrace Card
  if (sources?.stacktrace_used) {
    sourceCards.push({
      key: 'stacktrace',
      onClick: () => {
        if (navigate && location) {
          navigate({
            pathname: location.pathname,
            query: location.query,
            hash: SectionKey.EXCEPTION,
          });
          requestAnimationFrame(() => {
            document
              .getElementById(SectionKey.EXCEPTION)
              ?.scrollIntoView({block: 'start', behavior: 'smooth'});
          });
        }
      },
      icon: <IconStack size="xs" />,
      label: t('Stacktrace'),
      isPrimary,
    });
  }

  // Breadcrumbs Card
  if (sources?.breadcrumbs_used) {
    sourceCards.push({
      key: 'breadcrumbs',
      onClick: () => {
        if (navigate && location) {
          navigate({
            pathname: location.pathname,
            query: location.query,
            hash: SectionKey.REQUEST,
          });
          requestAnimationFrame(() => {
            document
              .getElementById(SectionKey.BREADCRUMBS)
              ?.scrollIntoView({block: 'start', behavior: 'smooth'});
          });
        }
      },
      icon: <IconList size="xs" />,
      label: t('Breadcrumbs'),
      isPrimary,
    });
  }

  // HTTP Request Card
  if (sources?.http_request_used) {
    sourceCards.push({
      key: 'http-request',
      onClick: () => {
        if (navigate && location) {
          navigate({
            pathname: location.pathname,
            query: location.query,
            hash: SectionKey.REQUEST,
          });
          requestAnimationFrame(() => {
            document
              .getElementById(SectionKey.REQUEST)
              ?.scrollIntoView({block: 'start', behavior: 'smooth'});
          });
        }
      },
      icon: <IconGlobe size="xs" />,
      label: t('HTTP Request'),
      isPrimary,
    });
  }

  // Trace Event Cards
  sources?.trace_event_ids_used?.forEach(id => {
    sourceCards.push({
      key: `trace-${id}`,
      onClick: () => {
        if (sources?.event_trace_id) {
          window.open(
            `/explore/traces/trace/${sources.event_trace_id}/?node=span-${id}&timestamp=${sources.event_trace_timestamp?.toString() ?? ''}`,
            '_blank'
          );
        }
      },
      icon: <IconSpan size="xs" />,
      label: t('Trace: %s', id.substring(0, 7)),
      isPrimary,
    });
  });

  // Profile ID Cards
  sources?.profile_ids_used?.forEach(id => {
    sourceCards.push({
      key: `profile-${id}`,
      icon: <IconProfiling size="xs" />,
      onClick: () => window.open(`/explore/profiling/profile/${id}/flamegraph`, '_blank'),
      label: t('Profile: %s', id.substring(0, 7)),
      isPrimary,
    });
  });

  // Connected Error ID Cards
  sources?.connected_error_ids_used?.forEach(id => {
    sourceCards.push({
      key: `error-${id}`,
      onClick: () => {
        if (sources?.event_trace_id) {
          window.open(
            `/issues/trace/${sources.event_trace_id}?node=error-${id}`,
            '_blank'
          );
        }
      },
      icon: <IconFatal size="xs" />,
      label: t('Error: %s', id.substring(0, 7)),
      isPrimary,
    });
  });

  // Code URL Cards
  sources?.code_used_urls?.forEach(url => {
    sourceCards.push({
      key: `code-${url}`,
      onClick: () => window.open(url, '_blank'),
      icon: <IconCode size="xs" />,
      label: getCodeSourceName(url),
      isPrimary,
    });
  });

  if (codeUrls) {
    codeUrls.forEach(url => {
      sourceCards.push({
        key: `passed-code-${url}`,
        onClick: () => window.open(url, '_blank'),
        icon: <IconCode size="xs" />,
        label: getCodeSourceName(url),
        isPrimary,
      });
    });
  }

  // Diff URL Cards
  sources?.diff_urls?.forEach(url => {
    sourceCards.push({
      key: `diff-${url}`,
      onClick: () => window.open(url, '_blank'),
      icon: <IconCommit size="xs" />,
      label: t('Commit %s', getCommitSha(url)),
      isPrimary,
    });
  });

  return sourceCards;
}

export default AutofixInsightSources;
