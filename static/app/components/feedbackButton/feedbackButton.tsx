import {useRef, type ReactNode} from 'react';

import {Button, type ButtonProps} from 'sentry/components/core/button';
import {type UseFeedbackOptions} from 'sentry/components/feedbackButton/useFeedbackSDKIntegration';
import {IconMegaphone} from 'sentry/icons/iconMegaphone';
import {t} from 'sentry/locale';
import {useFeedbackForm} from 'sentry/utils/useFeedbackForm';

interface Props extends Omit<ButtonProps, 'children'> {
  children?: ReactNode;
  feedbackOptions?: UseFeedbackOptions;
}

/**
 * A button component that opens the Sentry feedback widget when clicked.
 *
 * Use this component to embed a feedback collection button anywhere in the UI where users
 * might want to submit feedback, report issues, or share suggestions with your team.
 *
 * The feedback form will stay open even if the button itself it removed from the
 * DOM. So you can add buttons inside of Dropdowns or Tooltips for example.
 *
 * The component will return null when the Feedback SDK integration is not enabled,
 * like in self-hosted environments.
 *
 * It's strongly recommended to add the tags: `feedback.source` and `feedback.owner`
 * and then setup an alert rule to notify you when feedback is submitted.
 *
 * @example
 * // Mix of Button and Feedback props
 * <FeedbackButton
 *   priority="primary"
 *   size="lg"
 *   feedbackOptions={{
 *     messagePlaceholder: 'Tell us what you think...',
 *     tags: {
 *       ['feedback.source']: 'issue-details'
 *       ['feedback.owner']: 'issues'
 *     }
 *   }}
 * />
 *
 * @param feedbackOptions - Optional configuration to customize the feedback widget behavior,
 *                          such as form labels, tags, or user metadata
 *
 * @param children - The content to display inside the button. If not provided, the default label 'Give Feedback' will be used.
 *
 * @param * - All standard Button props except `icon` (icon is fixed to megaphone).
 *                      Includes size, priority, disabled, onClick handlers, etc.
 *
 * @returns A Button that opens the feedback widget on click, or null if feedback is not enabled
 */
export default function FeedbackButton({feedbackOptions, ...buttonProps}: Props) {
  const buttonRef = useRef<HTMLButtonElement>(null);
  const openForm = useFeedbackForm();

  // Do not show button if Feedback integration is not enabled
  if (!openForm) {
    return null;
  }

  const children = 'children' in buttonProps ? buttonProps.children : t('Give Feedback');

  return (
    <Button
      ref={buttonRef}
      size="sm"
      icon={<IconMegaphone />}
      {...buttonProps}
      onClick={e => {
        openForm?.(feedbackOptions);
        buttonProps.onClick?.(e);
      }}
    >
      {children}
    </Button>
  );
}
