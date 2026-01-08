import {useRef} from 'react';
import styled from '@emotion/styled';

import {Button} from 'sentry/components/core/button';
import {Flex} from 'sentry/components/core/layout';
import ErrorBoundary from 'sentry/components/errorBoundary';
import FeedbackActions from 'sentry/components/feedback/feedbackItem/feedbackActions';
import FeedbackShortId from 'sentry/components/feedback/feedbackItem/feedbackShortId';
import FeedbackViewers from 'sentry/components/feedback/feedbackItem/feedbackViewers';
import {StreamlinedExternalIssueList} from 'sentry/components/group/externalIssuesList/streamlinedExternalIssueList';
import {IconArrow} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Event} from 'sentry/types/event';
import type {Group} from 'sentry/types/group';
import type {FeedbackIssue} from 'sentry/utils/feedback/types';
import {useDimensions} from 'sentry/utils/useDimensions';

interface Props {
  eventData: Event | undefined;
  feedbackItem: FeedbackIssue;
  onBackToList?: () => void;
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

export default function FeedbackItemHeader({
  eventData,
  feedbackItem,
  onBackToList,
}: Props) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const dimensions = useDimensions({elementRef: wrapperRef});

  return (
    <VerticalSpacing ref={wrapperRef}>
      <Flex wrap="wrap" flex="1 1 auto" gap="md" justify="between">
        <Flex gap="md" align="center">
          {onBackToList && (
            <Button
              priority="primary"
              icon={<IconArrow direction="left" size="xs" />}
              onClick={onBackToList}
              size="zero"
              aria-label={t('Back to list')}
            />
          )}
          <FeedbackShortId feedbackItem={feedbackItem} />
        </Flex>
        <FeedbackActions
          eventData={eventData}
          feedbackItem={feedbackItem}
          size={dimensionsToSize(dimensions)}
          style={{lineHeight: 1}}
        />
      </Flex>

      {eventData && feedbackItem.project ? (
        <ErrorBoundary mini>
          <Flex wrap="wrap" justify="between" align="center" gap="md">
            <Flex direction="row" gap="md">
              <StreamlinedExternalIssueList
                group={feedbackItem as unknown as Group}
                project={feedbackItem.project}
                event={eventData}
              />
            </Flex>
            {feedbackItem.seenBy.length ? (
              <Flex justify="end">
                <Flex gap="md" align="center">
                  <SeenBy>{t('Seen by')}</SeenBy>
                  <FeedbackViewers feedbackItem={feedbackItem} />
                </Flex>
              </Flex>
            ) : null}
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
  border-bottom: 1px solid ${p => p.theme.tokens.border.secondary};
`;

const SeenBy = styled('span')`
  color: ${p => p.theme.subText};
  font-size: ${p => p.theme.fontSize.sm};
`;
