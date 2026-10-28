import {useState} from 'react';

import {Button} from '@sentry/scraps/button';
import {Flex, Stack} from '@sentry/scraps/layout';
import {TextArea} from '@sentry/scraps/textarea';

import {t} from 'sentry/locale';

/** The longest question the `provide_input` command accepts. */
const MAX_PROMPT_LENGTH = 20_000;

function isSubmitKey(event: React.KeyboardEvent) {
  return event.key === 'Enter' && !event.shiftKey && !event.altKey;
}

/**
 * Asks for the question an investigation was started without. Seer parks a run
 * that has no question before it looks at anything, and nothing moves it on
 * until someone supplies one.
 *
 * What was typed stays put while `busy`, so the viewer can read what they sent
 * while Seer picks it up, and send it again if Seer couldn't.
 */
export function InvestigationPromptForm({
  busy,
  onSubmit,
}: {
  busy: boolean;
  onSubmit: (prompt: string) => void;
}) {
  const [value, setValue] = useState('');
  const prompt = value.trim();

  const submit = () => {
    if (!prompt || busy) {
      return;
    }
    onSubmit(prompt);
  };

  return (
    <Stack gap="sm">
      <TextArea
        autosize
        aria-label={t('What should Seer investigate?')}
        placeholder={t('What should Seer investigate?')}
        value={value}
        disabled={busy}
        maxLength={MAX_PROMPT_LENGTH}
        rows={2}
        maxRows={10}
        onChange={event => setValue(event.target.value)}
        onKeyDown={event => {
          if (isSubmitKey(event)) {
            event.preventDefault();
            submit();
          }
        }}
      />
      <Flex justify="end">
        <Button
          variant="primary"
          size="sm"
          disabled={!prompt || busy}
          busy={busy}
          onClick={submit}
        >
          {t('Start investigation')}
        </Button>
      </Flex>
    </Stack>
  );
}
