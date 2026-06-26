import {useRef, useState} from 'react';

import {Button} from '@sentry/scraps/button';
import {InputGroup} from '@sentry/scraps/input';
import {Flex} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import {addErrorMessage} from 'sentry/actionCreators/indicator';
import {type useExplorerAutofix} from 'sentry/components/events/autofix/useExplorerAutofix';
import {IconArrow} from 'sentry/icons/iconArrow';
import {IconClose} from 'sentry/icons/iconClose';
import {IconReturn} from 'sentry/icons/iconReturn';
import {t} from 'sentry/locale';
import {trackAnalytics} from 'sentry/utils/analytics';
import {useOrganization} from 'sentry/utils/useOrganization';

interface PrIterationFeedbackFormProps {
  autofix: ReturnType<typeof useExplorerAutofix>;
  groupId: string;
  onClose?: () => void;
  referrer?: string;
  runId?: number;
}

export function PrIterationFeedbackForm({
  autofix,
  groupId,
  runId,
  referrer,
  onClose,
}: PrIterationFeedbackFormProps) {
  const organization = useOrganization();
  const {isPolling, startStep} = autofix;
  const [feedback, setFeedback] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const submitButtonRef = useRef<HTMLButtonElement>(null);

  const prompt = t('Anything else you want to see on your PR?');

  const handleSubmit = async () => {
    if (!feedback.trim()) {
      return;
    }
    // Show the loader immediately on click. We don't reuse `isPolling` here
    // because submitting kicks off a run that flips it, which can hide the
    // surrounding UI before a polling-driven busy state could render. The
    // component unmounts and remounts fresh (resetting this flag) once the run
    // completes.
    setIsSubmitting(true);
    try {
      await startStep('pr_iteration', {runId, userContext: feedback});
    } catch {
      setIsSubmitting(false);
      addErrorMessage(t('Failed to submit feedback. Please try again.'));
      return;
    }
    trackAnalytics('autofix.pr_iteration.feedback', {
      organization,
      group_id: groupId,
      mode: 'explorer',
      referrer,
    });
    // Dismiss the reset UI for callers that render this inline (e.g. the code
    // changes card) so it doesn't reappear after the run completes. Callers
    // without an onClose (e.g. the next-step view) keep relying on isSubmitting.
    onClose?.();
  };

  return (
    <Flex direction="column" gap="lg">
      <Text>{prompt}</Text>
      <InputGroup>
        <InputGroup.TextArea
          autosize
          rows={2}
          placeholder={t(
            'Give Seer additional context to improve your pull request and make changes to your code. Hit ENTER to submit.'
          )}
          value={feedback}
          disabled={isSubmitting}
          onChange={event => setFeedback(event.target.value)}
          onKeyDown={event => {
            if (event.nativeEvent.isComposing) {
              return;
            }
            if (event.key === 'Enter' && !event.shiftKey) {
              event.preventDefault();
              // Simulate a real click on the submit button (matching the Ask Seer
              // hotkey behavior) so the press goes through the button itself.
              submitButtonRef.current?.click();
            }
          }}
        />
        <InputGroup.TrailingItems style={{alignItems: 'flex-start', top: 12}}>
          <IconReturn variant="muted" />
        </InputGroup.TrailingItems>
      </InputGroup>
      <Flex gap="md">
        {onClose && (
          <Button aria-label={t('Close')} icon={<IconClose />} onClick={onClose} />
        )}
        <Button
          ref={submitButtonRef}
          icon={isSubmitting ? undefined : <IconArrow size="md" direction="right" />}
          disabled={isSubmitting || isPolling || !feedback.trim()}
          onClick={handleSubmit}
        >
          {isSubmitting ? t('Submitting feedback') : t('Submit')}
        </Button>
      </Flex>
    </Flex>
  );
}
