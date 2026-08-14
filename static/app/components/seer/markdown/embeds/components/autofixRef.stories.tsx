import {useState} from 'react';
import {useQuery} from '@tanstack/react-query';

import {Button, ButtonBar} from '@sentry/scraps/button';
import {AssistantMessage, MessageRow} from '@sentry/scraps/chat';
import {CompactSelect} from '@sentry/scraps/compactSelect';
import {Container, Flex, Stack} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import {getAutofixRunId} from 'sentry/components/events/autofix/autofixRunId';
import type {AutofixExplorerStep} from 'sentry/components/events/autofix/useExplorerAutofix';
import {useExplorerAutofix} from 'sentry/components/events/autofix/useExplorerAutofix';
import {SeerMarkdown} from 'sentry/components/seer/markdown';
import * as Storybook from 'sentry/stories';
import type {Group} from 'sentry/types/group';
import {apiOptions} from 'sentry/utils/api/apiOptions';
import {useOrganization} from 'sentry/utils/useOrganization';
import type {SeerExplorerRunId} from 'sentry/views/seerExplorer/types';

const STEPS: Array<{label: string; step: AutofixExplorerStep}> = [
  {step: 'root_cause', label: 'Root Cause'},
  {step: 'solution', label: 'Plan'},
  {step: 'code_changes', label: 'Code Changes'},
];

function autofixRefTag(
  group: Pick<Group, 'id' | 'shortId'>,
  step: AutofixExplorerStep,
  runId: SeerExplorerRunId
): string {
  return `{% autofixRef %}${JSON.stringify({id: group.id, shortId: group.shortId, runId, step})}{% /autofixRef %}`;
}

function useRecentIssues() {
  const organization = useOrganization();
  return useQuery({
    ...apiOptions.as<Group[]>()('/organizations/$organizationIdOrSlug/issues/', {
      path: {organizationIdOrSlug: organization.slug},
      query: {query: 'is:unresolved', statsPeriod: '14d', limit: 25},
      staleTime: 30_000,
    }),
  });
}

function IssuePicker({
  onChange,
  value,
}: {
  onChange: (group: Group) => void;
  value: Group | null;
}) {
  const {data: issues, isPending} = useRecentIssues();

  return (
    <CompactSelect
      searchable
      disabled={isPending}
      triggerLabel={value ? `${value.shortId} — ${value.title}` : 'Pick an issue…'}
      options={(issues ?? []).map(issue => ({
        value: issue.id,
        label: `${issue.shortId} — ${issue.title}`,
      }))}
      value={value?.id}
      onChange={opt => {
        const issue = issues?.find(candidate => candidate.id === opt.value);
        if (issue) {
          onChange(issue);
        }
      }}
    />
  );
}

function AutofixRefLiveDemo({group}: {group: Group}) {
  const autofix = useExplorerAutofix(group, {pollPR: true});
  const runId = getAutofixRunId(autofix.runState);
  const [triggeredSteps, setTriggeredSteps] = useState<AutofixExplorerStep[]>([]);

  function handleTrigger(step: AutofixExplorerStep) {
    autofix.startStep(step, runId ? {runId} : undefined);
    setTriggeredSteps(prev => (prev.includes(step) ? prev : [...prev, step]));
  }

  return (
    <Stack gap="xl">
      <Flex gap="md" align="center" wrap="wrap">
        <Text bold>{group.shortId}</Text>
        <ButtonBar>
          {STEPS.map(({step, label}) => (
            <Button
              key={step}
              size="sm"
              disabled={autofix.isPolling}
              onClick={() => handleTrigger(step)}
            >
              {triggeredSteps.includes(step) ? `Re-run: ${label}` : `Run: ${label}`}
            </Button>
          ))}
        </ButtonBar>
      </Flex>

      {!triggeredSteps.length && (
        <Text variant="muted">
          Pick a step above to kick off (or continue) an Autofix run for this issue.
        </Text>
      )}

      {triggeredSteps.length > 0 && !runId && (
        <Text variant="muted">Starting the run…</Text>
      )}

      {runId &&
        triggeredSteps.map(step => (
          <MessageRow key={step} from="assistant">
            <AssistantMessage>
              <SeerMarkdown raw={autofixRefTag(group, step, runId)} />
            </AssistantMessage>
          </MessageRow>
        ))}
    </Stack>
  );
}

function AutofixRefPicker() {
  const [group, setGroup] = useState<Group | null>(null);

  return (
    <Storybook.SizingWindow display="block">
      <Stack
        width="100%"
        maxWidth="640px"
        background="primary"
        border="primary"
        radius="md"
        padding="xl"
        gap="xl"
      >
        <Stack gap="md">
          <Text bold>Pick an issue to drive a live Autofix run</Text>
          <IssuePicker value={group} onChange={setGroup} />
        </Stack>
        <Container borderTop="primary" paddingTop="xl">
          {group ? (
            <AutofixRefLiveDemo key={group.id} group={group} />
          ) : (
            <Text variant="muted">No issue selected yet.</Text>
          )}
        </Container>
      </Stack>
    </Storybook.SizingWindow>
  );
}

export default Storybook.story('AutofixRef', story => {
  story('Live run against a picked issue', () => <AutofixRefPicker />);
});
