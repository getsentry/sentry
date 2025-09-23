import styled from '@emotion/styled';

import {Button} from 'sentry/components/core/button';
import type {InsightSources} from 'sentry/components/events/autofix/types';
import {
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
import {ellipsize} from 'sentry/utils/string/ellipsize';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
import {SectionKey} from 'sentry/views/issueDetails/streamline/context';

interface AutofixInsightSourcesProps {
  alignment?: 'left' | 'right';
  codeUrls?: string[];
  size?: 'zero' | 'xs' | 'sm' | 'md';
  sources?: InsightSources;
  textColor?: 'subText' | 'textColor';
  title?: string;
}

// Helper to extract a meaningful name from a code URL
export function getCodeSourceName(url: string): string {
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

function AutofixInsightSources({
  sources,
  title,
  codeUrls,
  size = 'xs',
  textColor = 'textColor',
  alignment = 'left',
}: AutofixInsightSourcesProps) {
  const navigate = useNavigate();
  const location = useLocation();

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
          navigate({
            pathname: location.pathname,
            query: {
              ...Object.fromEntries(
                Object.entries(location.query).filter(([k]) => k !== 'seerDrawer')
              ),
            },
            hash: SectionKey.EXCEPTION,
          });
          requestAnimationFrame(() => {
            document
              .getElementById(SectionKey.EXCEPTION)
              ?.scrollIntoView({block: 'start', behavior: 'smooth'});
          });
        }}
        size={size}
        textColor={textColor}
        icon={<IconStack />}
        priority="default"
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
          navigate({
            pathname: location.pathname,
            query: {
              ...Object.fromEntries(
                Object.entries(location.query).filter(([k]) => k !== 'seerDrawer')
              ),
            },
            hash: SectionKey.BREADCRUMBS,
          });
          requestAnimationFrame(() => {
            document
              .getElementById(SectionKey.BREADCRUMBS)
              ?.scrollIntoView({block: 'start', behavior: 'smooth'});
          });
        }}
        size={size}
        textColor={textColor}
        icon={<IconList />}
        priority="default"
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
          navigate({
            pathname: location.pathname,
            query: {
              ...Object.fromEntries(
                Object.entries(location.query).filter(([k]) => k !== 'seerDrawer')
              ),
            },
            hash: SectionKey.REQUEST,
          });
          requestAnimationFrame(() => {
            document
              .getElementById(SectionKey.REQUEST)
              ?.scrollIntoView({block: 'start', behavior: 'smooth'});
          });
        }}
        size={size}
        textColor={textColor}
        icon={<IconGlobe />}
        priority="default"
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
        size={size}
        textColor={textColor}
        icon={<IconSpan />}
        priority="default"
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
        size={size}
        textColor={textColor}
        icon={<IconProfiling />}
        onClick={() =>
          window.open(`/explore/profiling/profile/${id}/flamegraph`, '_blank')
        }
        priority="default"
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
        onClick={() => {
          if (sources?.event_trace_id) {
            window.open(
              `/issues/trace/${sources.event_trace_id}?node=error-${id}`,
              '_blank'
            );
          }
        }}
        size={size}
        textColor={textColor}
        icon={<IconFatal />}
        priority="default"
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
        size={size}
        textColor={textColor}
        icon={<IconCode />}
        priority="default"
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
          size={size}
          textColor={textColor}
          icon={<IconCode />}
          priority="default" // codeUrls are passed separately, not from expanded card
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
        size={size}
        textColor={textColor}
        icon={<IconCommit />}
        priority="default"
      >
        {t('Commit %s', getCodeSourceName(url))}
      </SourceCard>
    );
  });

  if (sourceCards.length === 0) {
    return null;
  }

  return (
    <SourcesContainer>
      <CardsContainer aria-label="Autofix Insight Sources" alignment={alignment}>
        {sourceCards}
      </CardsContainer>
    </SourcesContainer>
  );
}

const SourcesContainer = styled('div')`
  width: 100%;
`;

const CardsContainer = styled('div')<{alignment: 'left' | 'right'}>`
  display: flex;
  flex-wrap: wrap;
  gap: ${space(0.5)};
  width: 100%;
  justify-content: ${p => (p.alignment === 'left' ? 'flex-start' : 'flex-end')};
  align-items: flex-start;
  align-content: flex-start;
`;

const SourceCard = styled(Button)<{textColor: 'subText' | 'textColor'}>`
  display: flex;
  align-items: center;
  gap: ${space(0.5)};
  font-weight: ${p => p.theme.fontWeight.normal};
  white-space: nowrap;
  flex-shrink: 1;
  min-width: 0;
  text-overflow: ellipsis;
  color: ${p => (p.textColor === 'subText' ? p.theme.subText : p.theme.textColor)};
`;

export default AutofixInsightSources;
