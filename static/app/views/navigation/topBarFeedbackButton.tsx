import {useMemo} from 'react';

import {FeedbackButton} from 'sentry/components/feedbackButton/feedbackButton';
import type {UseFeedbackOptions} from 'sentry/components/feedbackButton/useFeedbackSDKIntegration';
import {t} from 'sentry/locale';
import {useSeerExplorerChatState} from 'sentry/views/seerExplorer/seerExplorerChatStateContext';
import {useSeerExplorerContext} from 'sentry/views/seerExplorer/useSeerExplorerContext';
import {getExplorerFeedbackOptions} from 'sentry/views/seerExplorer/utils';

import {useTopBarActionDisplay} from './useTopBarActionDisplay';

const DEFAULT_FEEDBACK_OPTIONS: UseFeedbackOptions = {
  tags: {'feedback.source': 'top_navigation'},
};

export interface TopBarFeedbackButtonProps {
  /**
   * Overrides the accessible name and tooltip. The visible label is always
   * "Give Feedback", so the accessible name should start with it.
   */
  'aria-label'?: string;
  /**
   * Page-specific feedback options, such as `feedback.source` and
   * `feedback.owner` tags. Falls back to the top navigation defaults.
   * While the Seer Explorer is open, its feedback options take precedence.
   */
  feedbackOptions?: UseFeedbackOptions;
}

export function TopBarFeedbackButton({
  feedbackOptions,
  'aria-label': ariaLabel = t('Give Feedback'),
}: TopBarFeedbackButtonProps) {
  const {display} = useTopBarActionDisplay();
  const {isOpen: isSeerExplorerOpen} = useSeerExplorerContext();
  const {runId: seerExplorerRunId} = useSeerExplorerChatState();

  const resolvedFeedbackOptions = useMemo(() => {
    if (isSeerExplorerOpen) {
      return getExplorerFeedbackOptions(seerExplorerRunId);
    }
    return feedbackOptions ?? DEFAULT_FEEDBACK_OPTIONS;
  }, [isSeerExplorerOpen, seerExplorerRunId, feedbackOptions]);

  const isIconOnly = display === 'icon';
  const hasCustomLabel = ariaLabel !== t('Give Feedback');

  return (
    <FeedbackButton
      aria-label={ariaLabel}
      feedbackOptions={resolvedFeedbackOptions}
      tooltipProps={isIconOnly || hasCustomLabel ? {title: ariaLabel} : undefined}
    >
      {isIconOnly ? null : t('Give Feedback')}
    </FeedbackButton>
  );
}
