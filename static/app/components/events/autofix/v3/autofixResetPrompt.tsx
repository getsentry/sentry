import {useState, type ReactNode} from 'react';
import {IconClose} from '@sentry/icons/close';
import {IconRefresh} from '@sentry/icons/refresh';

import {Button} from '@sentry/scraps/button';
import {Flex, Stack} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';
import {TextArea} from '@sentry/scraps/textarea';

import {AUTOFIX_USER_CONTEXT_MAX_LENGTH} from 'sentry/components/events/autofix/types';
import {t} from 'sentry/locale';

interface AutofixResetPromptProps {
  onClosePrompt: () => void;
  onReset: (userContext: string) => void;
  placeholder: string;
  prompt: ReactNode;
  submitLabel?: string;
}

export function AutofixResetPrompt({
  onClosePrompt,
  onReset,
  placeholder,
  prompt,
  submitLabel = t('Re-run from here'),
}: AutofixResetPromptProps) {
  const [userContext, setUserContext] = useState('');

  return (
    <Stack gap="lg">
      <Text>{prompt}</Text>
      <TextArea
        autosize
        rows={2}
        autoFocus
        maxLength={AUTOFIX_USER_CONTEXT_MAX_LENGTH}
        placeholder={placeholder}
        value={userContext}
        onChange={event => setUserContext(event.target.value)}
      />
      <Flex justify="end" gap="md">
        <Button
          size="xs"
          icon={<IconClose size="xs" />}
          aria-label={t('Close')}
          tooltipProps={{title: t('Close')}}
          onClick={onClosePrompt}
        />
        <Button
          variant="primary"
          size="xs"
          icon={<IconRefresh size="xs" />}
          aria-label={submitLabel}
          disabled={!userContext.trim()}
          onClick={() => onReset(userContext.trim())}
        >
          {submitLabel}
        </Button>
      </Flex>
    </Stack>
  );
}
