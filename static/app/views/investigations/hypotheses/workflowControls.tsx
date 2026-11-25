import {useRef, useState} from 'react';
import {uuid4} from '@sentry/core';
import {useMutation, useQueryClient} from '@tanstack/react-query';

import {Button} from '@sentry/scraps/button';
import {Flex, Stack} from '@sentry/scraps/layout';
import {TextArea} from '@sentry/scraps/textarea';
import {toast} from '@sentry/scraps/toast';

import {t} from 'sentry/locale';
import {getApiUrl} from 'sentry/utils/api/getApiUrl';
import {fetchMutation} from 'sentry/utils/queryClient';
import {useOrganization} from 'sentry/utils/useOrganization';
import {getInvestigationDetailQueryOptions} from 'sentry/views/investigations/api';
import type {WorkflowReport} from 'sentry/views/investigations/types';

type Command =
  | {command: 'cancel' | 'retry' | 'recheck'}
  | {command: 'steer'; note: string}
  | {answers: string[]; command: 'provide_input'; inputId: string; nodeId: string};

export function WorkflowControls({
  report,
  notebookId,
}: {
  notebookId: string;
  report: WorkflowReport;
}) {
  const stopped = report.status === 'failed' || report.status === 'cancelled';
  const organization = useOrganization();
  const client = useQueryClient();
  const [steering, setSteering] = useState(false);
  const [note, setNote] = useState('');
  const [answers, setAnswers] = useState<Record<string, string[]>>({});
  const last = useRef<{id: string; key: string} | null>(null);
  const mutation = useMutation({
    mutationFn: (data: Command) => {
      const key = JSON.stringify([report.runId, data]);
      if (last.current?.key !== key) {
        last.current = {key, id: uuid4()};
      }
      return fetchMutation({
        url: getApiUrl(
          '/organizations/$organizationIdOrSlug/investigation-workflows/runs/$runId/commands/',
          {path: {organizationIdOrSlug: organization.slug, runId: report.runId}}
        ),
        method: 'POST',
        data: {...data, requestId: last.current.id},
      });
    },
    onSuccess: async () => {
      await client.invalidateQueries({
        queryKey: getInvestigationDetailQueryOptions(organization.slug, notebookId)
          .queryKey,
      });
      setNote('');
      setSteering(false);
      last.current = null;
    },
    onError: () =>
      toast.error(
        t('Unable to update the investigation. Refresh to check its latest status.')
      ),
  });
  return (
    <Stack gap="md">
      {report.pendingInputs?.map(input => (
        <Stack key={input.inputId} gap="sm">
          {input.questions.map((question, i) => (
            <label key={question}>
              {question}
              <TextArea
                value={answers[input.inputId]?.[i] ?? ''}
                maxLength={4000}
                onChange={event => {
                  const updated = [...(answers[input.inputId] ?? [])];
                  updated[i] = event.target.value;
                  setAnswers({...answers, [input.inputId]: updated});
                }}
              />
            </label>
          ))}
          <Button
            size="sm"
            disabled={
              mutation.isPending ||
              input.questions.some((_, i) => !answers[input.inputId]?.[i]?.trim())
            }
            onClick={() =>
              mutation.mutate({
                command: 'provide_input',
                nodeId: input.nodeId,
                inputId: input.inputId,
                answers: answers[input.inputId]!,
              })
            }
          >
            {t('Send answer')}
          </Button>
        </Stack>
      ))}
      <Flex gap="sm" wrap="wrap">
        {report.active ? (
          <Button
            size="sm"
            disabled={mutation.isPending}
            onClick={() => mutation.mutate({command: 'cancel'})}
          >
            {t('Stop investigation')}
          </Button>
        ) : (
          <Button
            size="sm"
            disabled={mutation.isPending}
            onClick={() => mutation.mutate({command: stopped ? 'retry' : 'recheck'})}
          >
            {stopped ? t('Restart investigation') : t('Recheck investigation')}
          </Button>
        )}
        {report.canSteer && (
          <Button size="sm" onClick={() => setSteering(!steering)}>
            {t('Steer investigation')}
          </Button>
        )}
      </Flex>
      {steering && report.canSteer && (
        <Stack gap="sm">
          <TextArea
            aria-label={t('Guidance for upcoming steps')}
            placeholder={t('What should upcoming steps focus on?')}
            maxLength={2000}
            value={note}
            onChange={e => setNote(e.target.value)}
          />
          <Button
            size="sm"
            disabled={!note.trim() || mutation.isPending}
            onClick={() => mutation.mutate({command: 'steer', note: note.trim()})}
          >
            {t('Send guidance')}
          </Button>
        </Stack>
      )}
    </Stack>
  );
}
