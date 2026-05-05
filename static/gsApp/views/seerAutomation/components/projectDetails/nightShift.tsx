import {useMutation} from '@tanstack/react-query';
import {z} from 'zod';

import {Alert} from '@sentry/scraps/alert';
import {FeatureBadge} from '@sentry/scraps/badge';
import {Button} from '@sentry/scraps/button';
import {AutoSaveForm, FieldGroup} from '@sentry/scraps/form';
import {Container, Flex, Stack} from '@sentry/scraps/layout';
import {Link} from '@sentry/scraps/link';
import {Text} from '@sentry/scraps/text';

import {addErrorMessage, addSuccessMessage} from 'sentry/actionCreators/indicator';
import {t} from 'sentry/locale';
import type {Project, SeerNightshiftTweaks} from 'sentry/types/project';
import {useUpdateProject} from 'sentry/utils/project/useUpdateProject';
import {fetchMutation} from 'sentry/utils/queryClient';
import {useOrganization} from 'sentry/utils/useOrganization';

// Keep these defaults in sync with the backend source of truth at
// `src/sentry/tasks/seer/night_shift/tweaks.py` (DEFAULT_INTELLIGENCE_LEVEL,
// DEFAULT_REASONING_EFFORT, DEFAULT_EXTRA_TRIAGE_INSTRUCTIONS, and the
// `seer.night_shift.issues_per_org` Sentry option that backs `max_candidates`).
const DEFAULT_INTELLIGENCE_LEVEL = 'high' as const;
const DEFAULT_REASONING_EFFORT = 'high' as const;
const DEFAULT_MAX_CANDIDATES = 10;
const DEFAULT_EXTRA_TRIAGE_INSTRUCTIONS = '';

type Level = 'low' | 'medium' | 'high';

function levelOptions(defaultValue: Level) {
  const labels: Record<Level, string> = {
    low: t('Low'),
    medium: t('Medium'),
    high: t('High'),
  };
  return (['low', 'medium', 'high'] as const).map(value => ({
    value,
    label: value === defaultValue ? t('%s (default)', labels[value]) : labels[value],
  }));
}

const INTELLIGENCE_LEVEL_OPTIONS = levelOptions(DEFAULT_INTELLIGENCE_LEVEL);
const REASONING_EFFORT_OPTIONS = levelOptions(DEFAULT_REASONING_EFFORT);

function getTweaks(project: Project): SeerNightshiftTweaks {
  return project.seerNightshiftTweaks ?? {};
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
  const updateProject = useUpdateProject(project);

  const {mutate: triggerRun, isPending: isTriggering} = useMutation({
    mutationFn: ({dryRun}: {dryRun: boolean}) =>
      fetchMutation({
        method: 'POST',
        url: `/projects/${organization.slug}/${project.slug}/seer/night-shift/`,
        data: {dryRun},
      }),
    onSuccess: (_data, {dryRun}) =>
      addSuccessMessage(
        dryRun ? t('Night Shift dry run started.') : t('Night Shift run started.')
      ),
    onError: (_error, {dryRun}) =>
      addErrorMessage(
        dryRun
          ? t('Unable to start Night Shift dry run.')
          : t('Unable to start Night Shift run.')
      ),
  });

  const tweaks = getTweaks(project);
  const disabled = !canWrite;

  return (
    <FieldGroup
      title={
        <Flex gap="xs" align="center">
          {t('Manually trigger night shift')}
          <FeatureBadge type="alpha" />
        </Flex>
      }
    >
      <Alert variant="warning">
        {t(
          "Night Shift runs Seer Autofix on a nightly schedule. Instead of reacting to issues one occurrence at a time, it looks at your project's open issues holistically, prioritizes the ones most likely to benefit from a fix, and drafts pull requests overnight so they're ready for review when you start the next day. This is debug UI for experimenting with Night Shift by triggering manual runs. It is not intended to ever be user facing."
        )}
      </Alert>

      <AutoSaveForm
        name="intelligence_level"
        schema={z.object({intelligence_level: z.enum(['low', 'medium', 'high'])})}
        initialValue={tweaks.intelligence_level ?? DEFAULT_INTELLIGENCE_LEVEL}
        mutationOptions={{
          mutationFn: ({intelligence_level}) =>
            updateProject.mutateAsync({
              seerNightshiftTweaks: {...getTweaks(project), intelligence_level},
            }),
        }}
      >
        {field => (
          <field.Layout.Row
            label={t('Intelligence Level')}
            hintText={t('Higher levels improve quality but increase latency and cost.')}
          >
            <field.Select
              disabled={disabled}
              value={field.state.value}
              onChange={field.handleChange}
              options={INTELLIGENCE_LEVEL_OPTIONS}
            />
          </field.Layout.Row>
        )}
      </AutoSaveForm>

      <AutoSaveForm
        name="reasoning_effort"
        schema={z.object({reasoning_effort: z.enum(['low', 'medium', 'high'])})}
        initialValue={tweaks.reasoning_effort ?? DEFAULT_REASONING_EFFORT}
        mutationOptions={{
          mutationFn: ({reasoning_effort}) =>
            updateProject.mutateAsync({
              seerNightshiftTweaks: {...getTweaks(project), reasoning_effort},
            }),
        }}
      >
        {field => (
          <field.Layout.Row
            label={t('Reasoning Effort')}
            hintText={t('How much the agent thinks before answering.')}
          >
            <field.Select
              disabled={disabled}
              value={field.state.value}
              onChange={field.handleChange}
              options={REASONING_EFFORT_OPTIONS}
            />
          </field.Layout.Row>
        )}
      </AutoSaveForm>

      <AutoSaveForm
        name="max_candidates"
        schema={z.object({
          max_candidates: z
            .string()
            .regex(/^\d+$/, t('Must be a positive integer'))
            .refine(
              v => Number(v) >= 1 && Number(v) <= 100,
              t('Must be between 1 and 100')
            ),
        })}
        initialValue={String(tweaks.max_candidates ?? DEFAULT_MAX_CANDIDATES)}
        mutationOptions={{
          mutationFn: ({max_candidates}) =>
            updateProject.mutateAsync({
              seerNightshiftTweaks: {
                ...getTweaks(project),
                max_candidates: Number(max_candidates),
              },
            }),
        }}
      >
        {field => (
          <field.Layout.Row
            label={t('Max Candidates')}
            hintText={t(
              'How many issues to consider on each manual run. Default: %s.',
              DEFAULT_MAX_CANDIDATES
            )}
          >
            <field.Input
              type="number"
              min={1}
              max={100}
              disabled={disabled}
              value={field.state.value}
              onChange={field.handleChange}
            />
          </field.Layout.Row>
        )}
      </AutoSaveForm>

      <AutoSaveForm
        name="extra_triage_instructions"
        schema={z.object({extra_triage_instructions: z.string()})}
        initialValue={
          tweaks.extra_triage_instructions ?? DEFAULT_EXTRA_TRIAGE_INSTRUCTIONS
        }
        mutationOptions={{
          mutationFn: ({extra_triage_instructions}) =>
            updateProject.mutateAsync({
              seerNightshiftTweaks: {
                ...getTweaks(project),
                extra_triage_instructions,
              },
            }),
        }}
      >
        {field => (
          <field.Layout.Row
            label={t('Extra Triage Instructions')}
            hintText={t(
              'Free-text instructions appended to the triage prompt for this project. Default: empty.'
            )}
          >
            <field.TextArea
              disabled={disabled}
              value={field.state.value}
              onChange={field.handleChange}
              rows={4}
            />
          </field.Layout.Row>
        )}
      </AutoSaveForm>

      <Row
        label={t('Runs')}
        hintText={t('View past Night Shift runs for this organization.')}
      >
        <Link to={`/organizations/${organization.slug}/issues/autofix/`}>
          {t('View organization runs')}
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
            variant="primary"
            disabled={!canWrite || isTriggering}
            busy={isTriggering}
            onClick={() => triggerRun({dryRun: false})}
          >
            {t('Run Now')}
          </Button>
          <Button
            disabled={!canWrite || isTriggering}
            busy={isTriggering}
            onClick={() => triggerRun({dryRun: true})}
          >
            {t('Dry Run')}
          </Button>
        </Flex>
      </Row>
    </FieldGroup>
  );
}
