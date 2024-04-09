import {useRef} from 'react';
import {css} from '@emotion/react';
import styled from '@emotion/styled';

import ErrorBoundary from 'sentry/components/errorBoundary';
import FeedbackActions from 'sentry/components/feedback/feedbackItem/feedbackActions';
import FeedbackShortId from 'sentry/components/feedback/feedbackItem/feedbackShortId';
import IssueTrackingSection from 'sentry/components/feedback/feedbackItem/issueTrackingSection';
import {Flex} from 'sentry/components/profiling/flex';
import {space} from 'sentry/styles/space';
import type {Event, Group} from 'sentry/types';
import type {FeedbackIssue} from 'sentry/utils/feedback/types';
import {useDimensions} from 'sentry/utils/useDimensions';

interface Props {
  eventData: Event | undefined;
  feedbackItem: FeedbackIssue;
}

const fixIssueLinkSpacing = css`
  gap: ${space(1)} ${space(2)};

  & > span > div {
    margin-bottom: 0;
  }
`;

type Dimensions = ReturnType<typeof useDimensions>;
function dimensionsToSize({width}: Dimensions) {
  if (width < 600) {
    return 'small';
  }
  if (width < 800) {
    return 'medium';
  }
  return 'large';
}

export default function FeedbackItemHeader({eventData, feedbackItem}: Props) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const dimensions = useDimensions({elementRef: wrapperRef});

  return (
    <VerticalSpacing ref={wrapperRef}>
      <Flex wrap="wrap" flex="1 1 auto" gap={space(1)} justify="space-between">
        <FeedbackShortId feedbackItem={feedbackItem} />
        <FeedbackActions
          eventData={eventData}
          feedbackItem={feedbackItem}
          size={dimensionsToSize(dimensions)}
        />
      </Flex>

      {eventData && (
        <Flex wrap="wrap" justify="flex-start" css={fixIssueLinkSpacing}>
          <ErrorBoundary mini>
            <IssueTrackingSection
              group={feedbackItem as unknown as Group}
              project={feedbackItem.project}
              event={eventData}
            />
          </ErrorBoundary>
        </Flex>
      )}
    </VerticalSpacing>
  );
}

const VerticalSpacing = styled('div')`
  display: flex;
  flex-direction: column;
  gap: ${space(1)};
  padding: ${space(1.5)} ${space(2)};
  border-bottom: 1px solid ${p => p.theme.innerBorder};
`;
