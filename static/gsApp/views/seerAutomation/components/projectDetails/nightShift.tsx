import {useMutation} from '@tanstack/react-query';

import {FeatureBadge} from '@sentry/scraps/badge';
import {Button} from '@sentry/scraps/button';
import {FieldGroup} from '@sentry/scraps/form';
import {InfoTip} from '@sentry/scraps/info';
import {Container, Flex, Stack} from '@sentry/scraps/layout';
import {Link} from '@sentry/scraps/link';
import {Switch} from '@sentry/scraps/switch';
import {Text} from '@sentry/scraps/text';

import {addErrorMessage, addSuccessMessage} from 'sentry/actionCreators/indicator';
import {t} from 'sentry/locale';
import type {Project, SeerNightshiftTweaks} from 'sentry/types/project';
import {useUpdateProject} from 'sentry/utils/project/useUpdateProject';
import {fetchMutation} from 'sentry/utils/queryClient';
import {useOrganization} from 'sentry/utils/useOrganization';

const DEFAULT_TWEAKS: Required<SeerNightshiftTweaks> = {
  enabled: false,
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
  const organization = useOrganization();
  const tweaks = {...DEFAULT_TWEAKS, ...project.seerNightshiftTweaks};

  const {mutate, isPending} = useUpdateProject(project);

  const save = (next: SeerNightshiftTweaks) =>
    mutate(
      {seerNightshiftTweaks: next},
      {
        onError: () => addErrorMessage(t('Unable to update Night Shift settings.')),
      }
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
        <Button
          priority="primary"
          disabled={!canWrite || isTriggering}
          busy={isTriggering}
          onClick={() => triggerRun()}
        >
          {t('Run Now')}
        </Button>
      </Row>
    </FieldGroup>
  );
}
