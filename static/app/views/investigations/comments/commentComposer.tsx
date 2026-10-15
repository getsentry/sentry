import {useState} from 'react';

import {Button} from '@sentry/scraps/button';
import {Composer, type ComposerPlugin, type ComposerValue} from '@sentry/scraps/composer';
import {Flex, Stack} from '@sentry/scraps/layout';

import {addErrorMessage} from 'sentry/actionCreators/indicator';
import {t} from 'sentry/locale';
import {useOrganization} from 'sentry/utils/useOrganization';
import {useCreateInvestigationCommentMutation} from 'sentry/views/investigations/api';

const NO_PLUGINS: ComposerPlugin[] = [];
const EMPTY_VALUE: ComposerValue = {text: '', mentions: []};

function isSubmitKey(event: React.KeyboardEvent) {
  return event.key === 'Enter' && !event.shiftKey && !event.altKey;
}

export function CommentComposer({
  investigationId,
  inputRef,
}: {
  investigationId: string;
  inputRef?: React.Ref<HTMLDivElement>;
}) {
  const organization = useOrganization();
  const [value, setValue] = useState(EMPTY_VALUE);
  const {mutate, isPending} = useCreateInvestigationCommentMutation(
    organization.slug,
    investigationId,
    {
      onSuccess: () => setValue(EMPTY_VALUE),
      onError: () => addErrorMessage(t('Unable to post comment')),
    }
  );
  const body = value.text.trim();

  const submit = () => {
    if (!body || isPending) {
      return;
    }
    mutate({body});
  };

  return (
    <Stack gap="sm">
      <Composer
        ref={inputRef}
        aria-label={t('Add a comment')}
        placeholder={t('Add a comment…')}
        value={value}
        onChange={setValue}
        plugins={NO_PLUGINS}
        minHeight={56}
        onKeyDown={event => {
          if (isSubmitKey(event)) {
            event.preventDefault();
            submit();
          }
        }}
      />
      {body ? (
        <Flex justify="end">
          <Button
            variant="primary"
            size="sm"
            disabled={isPending}
            busy={isPending}
            onClick={submit}
          >
            {t('Comment')}
          </Button>
        </Flex>
      ) : null}
    </Stack>
  );
}
