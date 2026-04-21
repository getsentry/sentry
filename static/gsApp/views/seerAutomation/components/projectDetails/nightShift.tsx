import {Button} from '@sentry/scraps/button';
import {CompactSelect} from '@sentry/scraps/compactSelect';
import {FieldGroup} from '@sentry/scraps/form';
import {Container, Flex, Stack} from '@sentry/scraps/layout';
import {Switch} from '@sentry/scraps/switch';
import {Text} from '@sentry/scraps/text';

import {addErrorMessage} from 'sentry/actionCreators/indicator';
import {t} from 'sentry/locale';
import type {Project, SeerNightshiftTweaks} from 'sentry/types/project';
import {useUpdateProject} from 'sentry/utils/project/useUpdateProject';

// Placeholder options until the Night Shift model selector is wired to the backend.
const MODEL_OPTIONS = [
  {value: 'default', label: t('Default')},
  {value: 'claude-opus-4-7', label: t('Claude Opus 4.7')},
  {value: 'claude-sonnet-4-6', label: t('Claude Sonnet 4.6')},
];

const DEFAULT_TWEAKS: Required<SeerNightshiftTweaks> = {
  enabled: false,
  model: 'default',
};

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
  const tweaks = {...DEFAULT_TWEAKS, ...project.seerNightshiftTweaks};

  const {mutate, isPending} = useUpdateProject(project);

  const save = (next: SeerNightshiftTweaks) =>
    mutate(
      {seerNightshiftTweaks: next},
      {
        onError: () => addErrorMessage(t('Unable to update Night Shift settings.')),
      }
    );

  const disabled = !canWrite || isPending;

  return (
    <FieldGroup title={t('Night Shift')}>
      <Row
        label={t('Enable Night Shift')}
        hintText={t(
          'Run Seer on your issues overnight, so fixes are ready when you start your day.'
        )}
      >
        <Switch
          checked={tweaks.enabled}
          onChange={event => save({...tweaks, enabled: event.target.checked})}
          disabled={disabled}
        />
      </Row>
      <Row
        label={t('Night Shift Model')}
        hintText={t('Pick which model Night Shift uses to analyze and fix issues.')}
      >
        <CompactSelect
          value={tweaks.model}
          options={MODEL_OPTIONS}
          onChange={opt => save({...tweaks, model: opt.value})}
          disabled={disabled}
        />
      </Row>
      <Row
        label={t('Test Run')}
        hintText={t(
          'Kick off a one-off Night Shift run against this project to preview behavior.'
        )}
      >
        <Button priority="primary" disabled={!canWrite} onClick={() => {}}>
          {t('Run Now')}
        </Button>
      </Row>
    </FieldGroup>
  );
}
