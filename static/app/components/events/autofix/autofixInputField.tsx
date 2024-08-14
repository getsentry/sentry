import {useCallback, useState} from 'react';
import styled from '@emotion/styled';

import {addErrorMessage} from 'sentry/actionCreators/indicator';
import {Button} from 'sentry/components/button';
import {
  type AutofixResponse,
  makeAutofixQueryKey,
} from 'sentry/components/events/autofix/useAutofix';
import TextArea from 'sentry/components/forms/controls/textarea';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import Panel from 'sentry/components/panels/panel';
import {t} from 'sentry/locale';
import {isCtrlKeyPressed} from 'sentry/utils/isCtrlKeyPressed';
import {setApiQueryData, useMutation, useQueryClient} from 'sentry/utils/queryClient';
import useApi from 'sentry/utils/useApi';

const useAutofixUserInstruction = (groupId: string, runId: string) => {
  const api = useApi();
  const queryClient = useQueryClient();

  const [instruction, setInstruction] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {mutate} = useMutation({
    mutationFn: (params: {instruction: string}) => {
      return api.requestPromise(`/issues/${groupId}/autofix/update/`, {
        method: 'POST',
        data: {
          run_id: runId,
          payload: {
            type: 'instruction',
            content: {
              type: 'text',
              text: params.instruction,
            },
          },
        },
      });
    },
    onSuccess: _ => {
      setApiQueryData<AutofixResponse>(
        queryClient,
        makeAutofixQueryKey(groupId),
        data => {
          if (!data || !data.autofix) {
            return data;
          }

          return {
            ...data,
            autofix: {
              ...data.autofix,
              status: 'PROCESSING',
            },
          };
        }
      );
    },
    onError: () => {
      addErrorMessage(t('Something went wrong when responding to autofix.'));
      setIsSubmitting(false);
    },
  });

  const sendInstruction = useCallback(() => {
    mutate({instruction});
    setIsSubmitting(true);
  }, [instruction, mutate, setIsSubmitting]);

  return {sendInstruction, instruction, setInstruction, isSubmitting};
};

export function AutofixInputField({groupId, runId}: {groupId: string; runId: string}) {
  const {sendInstruction, instruction, setInstruction, isSubmitting} =
    useAutofixUserInstruction(groupId, runId);

  return (
    <Card>
      <Title>{t("Doesn't look right? Tell Autofix what needs to be changed")}</Title>
      <form
        onSubmit={e => {
          e.preventDefault();
          sendInstruction();
        }}
      >
        <FormRow>
          <TextArea
            aria-label={t('Provide context')}
            placeholder={t('Rename the function foo_bar to fooBar')}
            value={instruction}
            onChange={e => setInstruction(e.target.value)}
            disabled={isSubmitting}
            onKeyDown={e => {
              if (isCtrlKeyPressed(e) && e.key === 'Enter') {
                sendInstruction();
              }
            }}
          />
          <Button
            type="submit"
            icon={
              isSubmitting && <ProcessingStatusIndicator size={18} mini hideMessage />
            }
            disabled={isSubmitting || !instruction}
          >
            {t('Send')}
          </Button>
        </FormRow>
      </form>
    </Card>
  );
}

const Card = styled(Panel)`
  padding: ${p => p.theme.space(2)};
  margin-bottom: 0;
  display: flex;
  flex-direction: column;
  gap: ${p => p.theme.space(1)};
`;

const Title = styled('div')`
  font-weight: bold;
  white-space: nowrap;
`;

const FormRow = styled('div')`
  display: flex;
  flex-direction: row;
  align-items: flex-start;
  gap: ${p => p.theme.space(1)};
  width: 100%;
`;

const ProcessingStatusIndicator = styled(LoadingIndicator)`
  && {
    margin: 0;
    height: 18px;
    width: 18px;
  }
`;
