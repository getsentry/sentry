import {useEffect, useRef, useState} from 'react';
import styled from '@emotion/styled';

import useFeedbackSummary from 'sentry/components/feedback/list/useFeedbackSummary';
import LoadingError from 'sentry/components/loadingError';
import Placeholder from 'sentry/components/placeholder';
import {IconSeer} from 'sentry/icons/iconSeer';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';

export default function FeedbackSummary() {
  const {error, loading, summary, tooFewFeedbacks} = useFeedbackSummary();
  const [expanded, setExpanded] = useState(false);
  const [isClamped, setIsClamped] = useState(false);
  const summaryRef = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    const checkClamped = () => {
      const el = summaryRef.current;
      if (el) {
        el.style.display = '-webkit-box';
        el.style.webkitLineClamp = '2';
        const clampedHeight = el.clientHeight;

        el.style.display = 'block';
        el.style.webkitLineClamp = 'unset';
        const fullHeight = el.clientHeight;

        setIsClamped(fullHeight > clampedHeight);

        // Restore to clamped state if not expanded
        if (!expanded) {
          el.style.display = '-webkit-box';
          el.style.webkitLineClamp = '2';
        }
      }
    };

    checkClamped();
    const el = summaryRef.current;
    if (!el) return undefined;

    const resizeObserver = new window.ResizeObserver(() => {
      checkClamped();
    });
    resizeObserver.observe(el);

    return () => {
      resizeObserver.disconnect();
    };
  }, [summary, loading, tooFewFeedbacks, expanded]);

  if (error) {
    return <LoadingError message={t('There was an error loading the summary')} />;
  }

  if (loading) {
    return <Placeholder height="100px" />;
  }

  if (tooFewFeedbacks) {
    return null;
  }

  return (
    <Summary>
      <SummaryIconContainer>
        <div>
          <IconSeer size="xs" />
        </div>
        <SummaryContainer>
          <SummaryHeader>{t('Feedback Summary')}</SummaryHeader>
          <SummaryContent
            ref={summaryRef}
            style={
              expanded
                ? {
                    display: 'block',
                    WebkitLineClamp: 'unset',
                    overflow: 'visible',
                  }
                : {}
            }
          >
            {summary}
          </SummaryContent>
          {!expanded && isClamped && (
            <ReadMoreButton type="button" onClick={() => setExpanded(true)}>
              {t('Read more')}
            </ReadMoreButton>
          )}
          {expanded && isClamped && (
            <ReadMoreButton type="button" onClick={() => setExpanded(false)}>
              {t('Show less')}
            </ReadMoreButton>
          )}
        </SummaryContainer>
      </SummaryIconContainer>
    </Summary>
  );
}

const SummaryContainer = styled('div')`
  display: flex;
  flex-direction: column;
  gap: ${space(1)};
  width: 100%;
`;

const SummaryHeader = styled('p')`
  font-size: ${p => p.theme.fontSizeMedium};
  font-weight: ${p => p.theme.fontWeightBold};
  margin: 0;
`;

const SummaryContent = styled('p')`
  font-size: ${p => p.theme.fontSizeSmall};
  color: ${p => p.theme.subText};
  margin: 0;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: normal;
  max-width: 100%;
  transition: -webkit-line-clamp 0.2s;
`;

const ReadMoreButton = styled('button')`
  background: none;
  border: none;
  color: ${p => p.theme.purple400};
  cursor: pointer;
  padding: 0;
  font-size: ${p => p.theme.fontSizeSmall};
  font-weight: ${p => p.theme.fontWeightBold};
  align-self: flex-start;
`;

const Summary = styled('div')`
  padding: ${space(2)};
  border: 1px solid ${p => p.theme.border};
  border-radius: ${p => p.theme.borderRadius};
`;

const SummaryIconContainer = styled('div')`
  display: flex;
  flex-direction: row;
  gap: ${space(1)};
`;
