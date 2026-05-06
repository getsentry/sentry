import {useState, type ReactNode} from 'react';

import {Button} from '@sentry/scraps/button';
import {Flex} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';
import {TextArea} from '@sentry/scraps/textarea';

import {IconClose} from 'sentry/icons/iconClose';
import {IconRefresh} from 'sentry/icons/iconRefresh';
import {t} from 'sentry/locale';

interface AutofixResetPromptProps {
  onClosePrompt: () => void;
  onReset: (userContext: string) => void;
  placeholder: string;
  prompt: ReactNode;
}

export function AutofixResetPrompt({
  onClosePrompt,
  onReset,
  placeholder,
  prompt,
}: AutofixResetPromptProps) {
  const [userContext, setUserContext] = useState('');

  return (
    <Flex direction="column" gap="lg">
      <Text>{prompt}</Text>
      <TextArea
        autosize
        rows={2}
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
          aria-label={t('Re-run from here')}
          onClick={() => onReset(userContext)}
        >
          {t('Re-run from here')}
        </Button>
      </Flex>
    </Flex>
  );
}
