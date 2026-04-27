import {useState} from 'react';
import {useMutation} from '@tanstack/react-query';

import {FeatureBadge} from '@sentry/scraps/badge';
import {Button} from '@sentry/scraps/button';
import {FieldGroup} from '@sentry/scraps/form';
import {InfoTip} from '@sentry/scraps/info';
import {Container, Flex, Stack} from '@sentry/scraps/layout';
import {Link} from '@sentry/scraps/link';
import {SegmentedControl} from '@sentry/scraps/segmentedControl';
import {Slider} from '@sentry/scraps/slider';
import {Text} from '@sentry/scraps/text';
import {TextArea} from '@sentry/scraps/textarea';

import {addErrorMessage, addSuccessMessage} from 'sentry/actionCreators/indicator';
import {t} from 'sentry/locale';
import type {
  Project,
  SeerNightshiftIntelligenceLevel,
  SeerNightshiftReasoningEffort,
  SeerNightshiftTriageStrategy,
  SeerNightshiftTweaks,
} from 'sentry/types/project';
import {useUpdateProject} from 'sentry/utils/project/useUpdateProject';
import {fetchMutation} from 'sentry/utils/queryClient';
import {useOrganization} from 'sentry/utils/useOrganization';

const DEFAULT_CANDIDATE_ISSUES = 10;
const MIN_CANDIDATE_ISSUES = 1;
const MAX_CANDIDATE_ISSUES = 100;

const DEFAULT_ISSUE_FETCH_LIMIT = 100;
const MIN_ISSUE_FETCH_LIMIT = 10;
const MAX_ISSUE_FETCH_LIMIT = 1000;

type TristateMode = 'default' | 'on' | 'off';

type TriageStrategyChoice = 'default' | SeerNightshiftTriageStrategy;
type IntelligenceLevelChoice = 'default' | SeerNightshiftIntelligenceLevel;
type ReasoningEffortChoice = 'default' | SeerNightshiftReasoningEffort;

function toTristateMode(value: boolean | undefined): TristateMode {
  if (value === true) {
    return 'on';
  }
  if (value === false) {
    return 'off';
  }
  return 'default';
}

function fromTristateMode(mode: TristateMode): boolean | undefined {
  if (mode === 'on') {
    return true;
  }
  if (mode === 'off') {
    return false;
  }
  return undefined;
}

function Row({
  label,
  hintText,
  children,
}: {
  children: React.ReactNode;
  hintText: React.ReactNode;
  label: React.ReactNode;
}) {
  return (
    <Flex direction="row" gap="xl" align="center" justify="between" flexGrow={1}>
      <Stack width="50%" gap="xs">
        <Text>{label}</Text>
        <Text size="sm" variant="muted">
          {hintText}
        </Text>
      </Stack>
      <Container flexGrow={1}>{children}</Container>
    </Flex>
  );
}

interface Props {
  canWrite: boolean;
  project: Project;
}

export function NightShift({canWrite, project}: Props) {
  const organization = useOrganization();
  const tweaks = project.seerNightshiftTweaks ?? ({} as SeerNightshiftTweaks);

  const {mutate, isPending} = useUpdateProject(project);

  const save = (next: SeerNightshiftTweaks) =>
    mutate(
      {seerNightshiftTweaks: next},
      {
        onError: () => addErrorMessage(t('Unable to update Night Shift settings.')),
      }
    );

  const candidateIssues = tweaks.candidateIssues ?? DEFAULT_CANDIDATE_ISSUES;
  const [candidateIssuesDraft, setCandidateIssuesDraft] = useState(candidateIssues);

  const issueFetchLimit = tweaks.issueFetchLimit ?? DEFAULT_ISSUE_FETCH_LIMIT;
  const [issueFetchLimitDraft, setIssueFetchLimitDraft] = useState(issueFetchLimit);

  const [extraInstructionsDraft, setExtraInstructionsDraft] = useState(
    tweaks.extraTriageInstructions ?? ''
  );

  const {mutate: triggerRun, isPending: isTriggering} = useMutation({
    mutationFn: () =>
      fetchMutation({
        method: 'POST',
        url: `/projects/${organization.slug}/${project.slug}/seer/night-shift/`,
      }),
    onSuccess: () => addSuccessMessage(t('Night Shift run started.')),
    onError: () => addErrorMessage(t('Unable to start Night Shift run.')),
  });

  const {mutate: triggerDryRun, isPending: isDryRunning} = useMutation({
    mutationFn: () =>
      fetchMutation({
        method: 'POST',
        url: `/projects/${organization.slug}/${project.slug}/seer/night-shift/`,
        data: {dry_run: true},
      }),
    onSuccess: () => addSuccessMessage(t('Night Shift dry run started.')),
    onError: () => addErrorMessage(t('Unable to start Night Shift dry run.')),
  });

  const disabled = !canWrite || isPending;

  return (
    <FieldGroup
      title={
        <Flex gap="xs" align="center">
          {t('Night Shift')}
          <FeatureBadge type="alpha" />
        </Flex>
      }
    >
      <Flex gap="xs" align="center">
        <Text size="sm" variant="muted">
          {t('Debug')}
        </Text>
        <InfoTip title={t('Prototype settings for Night Shift.')} size="sm" />
      </Flex>
      <Row
        label={t('Enable Night Shift')}
        hintText={t(
          'Run Seer on your issues overnight, so fixes are ready when you start your day. Use "Default" to follow the organization-wide setting.'
        )}
      >
        <SegmentedControl<TristateMode>
          aria-label={t('Enable Night Shift')}
          size="sm"
          value={toTristateMode(tweaks.enabled)}
          onChange={mode => save({...tweaks, enabled: fromTristateMode(mode)})}
          disabled={disabled}
        >
          <SegmentedControl.Item key="default">{t('Default')}</SegmentedControl.Item>
          <SegmentedControl.Item key="on">{t('On')}</SegmentedControl.Item>
          <SegmentedControl.Item key="off">{t('Off')}</SegmentedControl.Item>
        </SegmentedControl>
      </Row>
      <Row
        label={t('Dry Run')}
        hintText={t(
          'Skip side effects (no fixes posted, no notifications) for scheduled Night Shift runs. Use "Default" to follow the organization-wide setting.'
        )}
      >
        <SegmentedControl<TristateMode>
          aria-label={t('Dry Run')}
          size="sm"
          value={toTristateMode(tweaks.dryRun)}
          onChange={mode => save({...tweaks, dryRun: fromTristateMode(mode)})}
          disabled={disabled}
        >
          <SegmentedControl.Item key="default">{t('Default')}</SegmentedControl.Item>
          <SegmentedControl.Item key="on">{t('On')}</SegmentedControl.Item>
          <SegmentedControl.Item key="off">{t('Off')}</SegmentedControl.Item>
        </SegmentedControl>
      </Row>
      <Row
        label={t('Candidate Issues')}
        hintText={t(
          'Maximum number of issues Night Shift will consider per run for this project.'
        )}
      >
        <Flex align="center" gap="md">
          <Slider
            aria-label={t('Candidate Issues')}
            min={MIN_CANDIDATE_ISSUES}
            max={MAX_CANDIDATE_ISSUES}
            step={1}
            value={candidateIssuesDraft}
            onChange={setCandidateIssuesDraft}
            onChangeEnd={value => save({...tweaks, candidateIssues: value})}
            disabled={disabled}
          />
          <Text size="sm" tabular>
            {candidateIssuesDraft}
          </Text>
        </Flex>
      </Row>
      <Row
        label={t('Issue Fetch Limit')}
        hintText={t(
          'Maximum number of issues to fetch from the issue list before triage. Larger pools give triage more to choose from but cost more.'
        )}
      >
        <Flex align="center" gap="md">
          <Slider
            aria-label={t('Issue Fetch Limit')}
            min={MIN_ISSUE_FETCH_LIMIT}
            max={MAX_ISSUE_FETCH_LIMIT}
            step={10}
            value={issueFetchLimitDraft}
            onChange={setIssueFetchLimitDraft}
            onChangeEnd={value => save({...tweaks, issueFetchLimit: value})}
            disabled={disabled}
          />
          <Text size="sm" tabular>
            {issueFetchLimitDraft}
          </Text>
        </Flex>
      </Row>
      <Row
        label={t('Triage Strategy')}
        hintText={t(
          'Choose how Night Shift selects issues to work on. Use "Default" to follow the organization-wide setting.'
        )}
      >
        <SegmentedControl<TriageStrategyChoice>
          aria-label={t('Triage Strategy')}
          size="sm"
          value={tweaks.triageStrategy ?? 'default'}
          onChange={choice =>
            save({
              ...tweaks,
              triageStrategy: choice === 'default' ? undefined : choice,
            })
          }
          disabled={disabled}
        >
          <SegmentedControl.Item key="default">{t('Default')}</SegmentedControl.Item>
          <SegmentedControl.Item key="simple">{t('Simple')}</SegmentedControl.Item>
          <SegmentedControl.Item key="agentic">{t('Agentic')}</SegmentedControl.Item>
        </SegmentedControl>
      </Row>
      <Row
        label={t('Intelligence Level')}
        hintText={t(
          'Model intelligence used during triage. Higher levels are more accurate but slower and more expensive.'
        )}
      >
        <SegmentedControl<IntelligenceLevelChoice>
          aria-label={t('Intelligence Level')}
          size="sm"
          value={tweaks.intelligenceLevel ?? 'default'}
          onChange={choice =>
            save({
              ...tweaks,
              intelligenceLevel: choice === 'default' ? undefined : choice,
            })
          }
          disabled={disabled}
        >
          <SegmentedControl.Item key="default">{t('Default')}</SegmentedControl.Item>
          <SegmentedControl.Item key="low">{t('Low')}</SegmentedControl.Item>
          <SegmentedControl.Item key="medium">{t('Medium')}</SegmentedControl.Item>
          <SegmentedControl.Item key="high">{t('High')}</SegmentedControl.Item>
        </SegmentedControl>
      </Row>
      <Row
        label={t('Reasoning Effort')}
        hintText={t(
          'How much reasoning the triage model spends per issue. Higher effort improves quality at the cost of latency and tokens.'
        )}
      >
        <SegmentedControl<ReasoningEffortChoice>
          aria-label={t('Reasoning Effort')}
          size="sm"
          value={tweaks.reasoningEffort ?? 'default'}
          onChange={choice =>
            save({
              ...tweaks,
              reasoningEffort: choice === 'default' ? undefined : choice,
            })
          }
          disabled={disabled}
        >
          <SegmentedControl.Item key="default">{t('Default')}</SegmentedControl.Item>
          <SegmentedControl.Item key="low">{t('Low')}</SegmentedControl.Item>
          <SegmentedControl.Item key="medium">{t('Medium')}</SegmentedControl.Item>
          <SegmentedControl.Item key="high">{t('High')}</SegmentedControl.Item>
        </SegmentedControl>
      </Row>
      <Row
        label={t('Extra Triage Instructions')}
        hintText={t(
          'Additional context appended to the triage prompt. Use to bias Night Shift toward specific kinds of issues for this project.'
        )}
      >
        <TextArea
          aria-label={t('Extra Triage Instructions')}
          rows={3}
          autosize
          maxRows={8}
          value={extraInstructionsDraft}
          onChange={event => setExtraInstructionsDraft(event.target.value)}
          onBlur={event => {
            const value = event.target.value;
            if (value === (tweaks.extraTriageInstructions ?? '')) {
              return;
            }
            save({
              ...tweaks,
              extraTriageInstructions: value === '' ? undefined : value,
            });
          }}
          disabled={disabled}
        />
      </Row>
      <Row
        label={t('Runs')}
        hintText={t('View past Night Shift runs for this organization.')}
      >
        <Link to={`/organizations/${organization.slug}/seer/workflows/`}>
          {t('View runs')}
        </Link>
      </Row>
      <Row
        label={t('Test Run')}
        hintText={t(
          'Kick off a one-off Night Shift run against this project to preview behavior.'
        )}
      >
        <Flex gap="sm">
          <Button
            priority="primary"
            disabled={!canWrite || isTriggering || isDryRunning}
            busy={isTriggering}
            onClick={() => triggerRun()}
          >
            {t('Run Now')}
          </Button>
          <Button
            disabled={!canWrite || isTriggering || isDryRunning}
            busy={isDryRunning}
            onClick={() => triggerDryRun()}
          >
            {t('Dry Run')}
          </Button>
        </Flex>
      </Row>
    </FieldGroup>
  );
}
