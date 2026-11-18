import {useRef, useState} from 'react';
import {useSearchParams} from 'react-router';
import {uuid4} from '@sentry/core';
import {useMutation, useQuery} from '@tanstack/react-query';

import {Alert} from '@sentry/scraps/alert';
import {Button} from '@sentry/scraps/button';
import {CompactSelect} from '@sentry/scraps/compactSelect';
import {Input} from '@sentry/scraps/input';
import {Flex, Grid, Stack} from '@sentry/scraps/layout';
import {Heading, Text} from '@sentry/scraps/text';
import {TextArea} from '@sentry/scraps/textarea';

import {LoadingError} from 'sentry/components/loadingError';
import {LoadingIndicator} from 'sentry/components/loadingIndicator';
import {t} from 'sentry/locale';
import {fetchMutation} from 'sentry/utils/queryClient';
import {getRequestErrorUserMessage} from 'sentry/utils/requestError/getRequestErrorUserMessage';
import {RequestError} from 'sentry/utils/requestError/requestError';
import {useOrganization} from 'sentry/utils/useOrganization';
import {useSessionStorage} from 'sentry/utils/useSessionStorage';
import {InvestigationAccess} from 'sentry/views/investigations/detail/investigationAccess';

import {
  configOptions,
  runOptions,
  type AcceptedRun,
  type LabConfig,
  type Plan,
  type ProofResult,
} from './api';
import {JsonValue, RunInspector, WorkflowGraph, type ResultTab} from './inspector';

type Editor = 'workflow' | 'input' | 'fixture';

function LabEditor({config, org}: {config: LabConfig; org: string}) {
  const [params, setParams] = useSearchParams();
  const runId = params.get('run');
  const [tab, setTab] = useState<ResultTab>('output');
  const [editor, setEditor] = useState<Editor>('workflow');
  const [scenario, setScenario] = useState('agent');
  const [attempts, setAttempts] = useState(1);
  const [draft, setDraft] = useSessionStorage(`workflow-lab-draft:${org}`, {
    workflow: JSON.stringify(config.workflow, null, 2),
    input: JSON.stringify(config.input, null, 2),
    fixture: JSON.stringify(config.fixture, null, 2),
  });
  const [configUrl] = configOptions(org).queryKey;
  const runQuery = runOptions(org, runId, tab === 'activity');
  const {
    data: run,
    error: statusError,
    refetch,
  } = useQuery({
    ...runQuery,
    placeholderData: previous => (previous?.json.id === runId ? previous : undefined),
    refetchInterval: query =>
      query.state.data?.json.done ||
      (query.state.error instanceof RequestError &&
        (query.state.error.status === 403 || query.state.error.status === 404))
        ? false
        : 2000,
  });
  const request = useRef<{body: string; id: string} | null>(null);
  const readDraft = () => ({
    workflow: JSON.parse(draft.workflow),
    input: JSON.parse(draft.input),
    maxAttempts: attempts,
  });
  const validate = useMutation({
    mutationFn: () =>
      fetchMutation<Plan>({
        url: configUrl,
        method: 'POST',
        data: {action: 'validate', ...readDraft()},
      }),
  });
  const start = useMutation({
    mutationFn: () => {
      const data = readDraft();
      const body = JSON.stringify(data);
      if (request.current?.body !== body) {
        request.current = {body, id: uuid4()};
      }
      return fetchMutation<AcceptedRun>({
        url: configUrl,
        method: 'POST',
        data: {action: 'run', ...data, requestId: request.current.id},
      });
    },
    onSuccess: accepted => {
      request.current = null;
      proof.reset();
      setTab('output');
      setParams(previous => {
        previous.set('run', accepted.id);
        return previous;
      });
    },
  });
  const proof = useMutation({
    mutationFn: () =>
      fetchMutation<ProofResult>({
        url: configUrl,
        method: 'POST',
        data: {
          action: 'proof',
          ...readDraft(),
          scenario,
          fixture: JSON.parse(draft.fixture),
        },
      }),
    onSuccess: () => {
      setParams(previous => {
        previous.delete('run');
        return previous;
      });
      setTab('activity');
    },
  });
  const cancel = useMutation({
    mutationFn: () =>
      fetchMutation({
        url: runQuery.queryKey[0],
        method: 'POST',
        data: {command: 'cancel'},
      }),
    onSuccess: () => void refetch(),
  });
  const notebook =
    run?.notebook ?? (start.data?.id === runId && Boolean(start.data?.notebook));
  const active = Boolean(runId && !run?.done && !statusError);
  const busy = start.isPending || proof.isPending;
  const graph =
    validate.data ??
    (draft.workflow === JSON.stringify(config.workflow, null, 2)
      ? config.graph
      : undefined);
  const error = start.error || validate.error || proof.error || cancel.error;
  function updateEditor(value: string) {
    validate.reset();
    start.reset();
    proof.reset();
    setDraft(previous => ({...previous, [editor]: value}));
  }
  return (
    <Stack padding="xl" gap="lg" flex={1} minWidth={0}>
      <Heading as="h1">{t('Workflow Lab')}</Heading>
      <Grid
        gap="2xl"
        columns={{zero: 'minmax(0, 1fr)', xl: 'minmax(20rem, 2fr) minmax(0, 3fr)'}}
      >
        <Stack gap="md" minWidth={0}>
          <Flex gap="sm" align="center" wrap="wrap">
            <CompactSelect
              value={scenario}
              options={Object.entries(config.scenarios).map(([value, item]) => ({
                value,
                label: item.label,
              }))}
              onChange={({value}) => {
                setScenario(value);
                if (value === 'agent' && editor === 'fixture') {
                  setEditor('workflow');
                }
              }}
            />
            <Button
              disabled={busy || active}
              variant="primary"
              onClick={() => (scenario === 'agent' ? start.mutate() : proof.mutate())}
            >
              {t('Run')}
            </Button>
            {active && (
              <Button disabled={cancel.isPending} onClick={() => cancel.mutate()}>
                {t('Cancel run')}
              </Button>
            )}
            <Button disabled={validate.isPending} onClick={() => validate.mutate()}>
              {t('Validate')}
            </Button>
          </Flex>
          <Text>{config.scenarios[scenario]?.description}</Text>
          <Flex gap="sm" align="center" wrap="wrap">
            <CompactSelect
              value={editor}
              options={[
                {value: 'workflow' as const, label: t('Workflow JSON')},
                {value: 'input' as const, label: t('Input JSON')},
                ...(scenario === 'agent'
                  ? []
                  : [{value: 'fixture' as const, label: t('Recovery fixture')}]),
              ]}
              onChange={({value}) => setEditor(value)}
            />
            <label>
              {t('Max attempts')}{' '}
              <Input
                type="number"
                min={1}
                max={10}
                value={attempts}
                onChange={event => setAttempts(Number(event.target.value))}
              />
            </label>
          </Flex>
          <TextArea
            aria-label={editor}
            value={draft[editor]}
            rows={22}
            spellCheck={false}
            onChange={event => updateEditor(event.target.value)}
          />
          <Button
            size="sm"
            onClick={() => updateEditor(JSON.stringify(config[editor], null, 2))}
          >
            {t('Restore example')}
          </Button>
          {error && <Alert variant="danger">{getRequestErrorUserMessage(error)}</Alert>}
          {graph && (
            <WorkflowGraph key={JSON.stringify(graph)} plan={graph} nodes={run?.nodes} />
          )}
          <details>
            <summary>{t('Registered skills and schemas')}</summary>
            <JsonValue value={{skills: config.skills, schemas: config.schemas}} />
          </details>
        </Stack>
        <Stack gap="md" minWidth={0}>
          {run && <Text bold>{run.status}</Text>}
          {statusError && <LoadingError onRetry={refetch} />}
          {proof.data && !runId && !proof.data.success && (
            <Alert variant="danger">{t('The recovery test failed.')}</Alert>
          )}
          <RunInspector
            run={run}
            proof={runId ? undefined : proof.data}
            notebook={notebook}
            tab={tab === 'notebook' && !notebook ? 'output' : tab}
            onTabChange={setTab}
          />
        </Stack>
      </Grid>
    </Stack>
  );
}

function WorkflowLabContent() {
  const {slug} = useOrganization();
  const config = useQuery(configOptions(slug));
  if (!config.data) {
    return config.isError ? (
      <LoadingError onRetry={config.refetch} />
    ) : (
      <LoadingIndicator />
    );
  }
  return <LabEditor key={slug} config={config.data} org={slug} />;
}

export default function WorkflowLab() {
  return (
    <InvestigationAccess>
      <WorkflowLabContent />
    </InvestigationAccess>
  );
}
