import {useRef} from 'react';
import styled from '@emotion/styled';

import {Flex} from 'sentry/components/container/flex';
import ErrorBoundary from 'sentry/components/errorBoundary';
import FeedbackActions from 'sentry/components/feedback/feedbackItem/feedbackActions';
import FeedbackShortId from 'sentry/components/feedback/feedbackItem/feedbackShortId';
import {StreamlinedExternalIssueList} from 'sentry/components/group/externalIssuesList/streamlinedExternalIssueList';
import {space} from 'sentry/styles/space';
import type {Event} from 'sentry/types/event';
import type {Group} from 'sentry/types/group';
import type {FeedbackIssue} from 'sentry/utils/feedback/types';
import {useDimensions} from 'sentry/utils/useDimensions';

interface Props {
  eventData: Event | undefined;
  feedbackItem: FeedbackIssue;
}

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
          style={{lineHeight: 1}}
        />
      </Flex>

      {eventData && feedbackItem.project ? (
        <ErrorBoundary mini>
          <Flex wrap="wrap" justify="flex-start" align="center" gap={space(1)}>
            <StreamlinedExternalIssueList
              group={feedbackItem as unknown as Group}
              project={feedbackItem.project}
              event={eventData}
            />
          </Flex>
        </ErrorBoundary>
      ) : null}
    </VerticalSpacing>
  );
}

const VerticalSpacing = styled('div')`
  display: flex;
  flex-direction: column;
  gap: ${space(1)};
  padding: ${space(1)} ${space(2)};
  border-bottom: 1px solid ${p => p.theme.innerBorder};
`;
