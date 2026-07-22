import {Button, ButtonBar, type ButtonBarProps} from '@sentry/scraps/button';

import {CopyToClipboardButton} from 'sentry/components/copyToClipboardButton';
import {IconThumb} from 'sentry/icons';
import {t} from 'sentry/locale';

type AssistantFeedback = 'positive' | 'negative';

interface AssistantActionsProps extends Omit<ButtonBarProps, 'children' | 'onCopy'> {
  /**
   * Text copied by the copy button. When omitted or empty, the copy button is
   * hidden.
   */
  copyText?: string;
  /**
   * Locks the feedback buttons — e.g. once a vote has been recorded — and
   * switches their tooltip to a submitted state.
   */
  feedbackDisabled?: boolean;
  /**
   * Fired after the response is copied. Analytics are the caller's
   * responsibility.
   */
  onCopy?: (copiedText: string) => void;
  /**
   * Fired when the user votes on the response. The meaning of a vote and any
   * analytics/persistence are the caller's responsibility.
   */
  onFeedback?: (feedback: AssistantFeedback) => void;
}

/**
 * The action bar for an assistant's response: thumbs up/down feedback and a
 * copy button.
 *
 * Presentation only — it renders the controls and reports votes through
 * `onFeedback` and copies through `onCopy`. It holds no submitted state and
 * fires no analytics; the caller owns what a vote means and what to copy.
 * Placement (and any hover-reveal) is the caller's responsibility via the
 * forwarded `ButtonBar` props.
 */
export function AssistantActions({
  onFeedback,
  feedbackDisabled,
  copyText,
  onCopy,
  size = 'xs',
  ...props
}: AssistantActionsProps) {
  return (
    <ButtonBar size={size} {...props}>
      <FeedbackButton
        feedback="positive"
        disabled={feedbackDisabled}
        onClick={onFeedback}
      />
      <FeedbackButton
        feedback="negative"
        disabled={feedbackDisabled}
        onClick={onFeedback}
      />
      {copyText ? (
        <CopyToClipboardButton
          aria-label={t('Copy to clipboard')}
          text={copyText}
          tooltipProps={{title: t('Copy to clipboard')}}
          onCopy={onCopy}
          onClick={e => {
            e.stopPropagation();
          }}
        />
      ) : null}
    </ButtonBar>
  );
}

function FeedbackButton({
  feedback,
  disabled,
  onClick,
}: {
  feedback: AssistantFeedback;
  disabled?: boolean;
  onClick?: (feedback: AssistantFeedback) => void;
}) {
  const isPositive = feedback === 'positive';
  const label = disabled
    ? t('Feedback submitted')
    : isPositive
      ? t('I like this response')
      : t("I don't like this response");
  return (
    <Button
      aria-label={label}
      icon={<IconThumb direction={isPositive ? 'up' : 'down'} />}
      disabled={disabled}
      tooltipProps={{title: label}}
      onClick={e => {
        e.stopPropagation();
        onClick?.(feedback);
      }}
    />
  );
}
