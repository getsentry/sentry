import {LayoutGroup, motion} from 'framer-motion';

import {Button} from '@sentry/scraps/button';
import {InfoTip} from '@sentry/scraps/info';
import {Flex, Grid, Stack} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import {IconCheckmark, IconClose, IconLock} from 'sentry/icons';
import {t} from 'sentry/locale';
import type {Integration, Repository} from 'sentry/types/integrations';

import {ScmIntegrationConnect} from './components/scmIntegrationConnect';
import {ScmStepHeader} from './components/scmStepHeader';
import {useScmProviders} from './components/useScmProviders';
import {SCM_STEP_CONTENT_WIDTH} from './consts';
import type {StepProps} from './types';

interface ScmConnectProps {
  // Fired once per user-driven repo change so callers can invalidate state
  // derived from the repo (platform, features, created project). See
  // ScmRepoSelector for why this is separate from onRepositoryChange.
  onClearDerivedState: () => void;
  onComplete: StepProps['onComplete'];
  onIntegrationChange: (integration: Integration | undefined) => void;
  onRepositoryChange: (repo: Repository | undefined) => void;
  selectedIntegration: Integration | undefined;
  selectedRepository: Repository | undefined;
  genBackButton?: StepProps['genBackButton'];
}

const SCM_INFO_SECTIONS = [
  {
    title: t('How we use access'),
    icon: <IconCheckmark size="xs" variant="success" />,
    items: [
      t('Source code context: show code around errors'),
      t('Commit attribution: identify which commit introduced an issue'),
      t('Auto assignment: route issues by code ownership'),
      t('AI debugging: connect code to telemetry to debug and fix issues'),
    ],
  },
  {
    title: t('Never without your permission'),
    tooltip: t(
      "If a feature needs more access to your code, we'll always ask you first. No surprises."
    ),
    icon: <IconClose size="xs" variant="danger" />,
    items: [
      t('Train AI on your code'),
      t('Use your code for anything beyond debugging and support'),
      t('Merge code into your branches'),
    ],
  },
];

export function ScmConnect({
  onClearDerivedState,
  onComplete,
  onIntegrationChange,
  onRepositoryChange,
  selectedIntegration,
  selectedRepository,
  genBackButton,
}: ScmConnectProps) {
  // React Query dedupes with ScmIntegrationConnect's call; only the
  // activeIntegrationExisting fallback is needed here for the footer's
  // analyticsParams and the "commit auto-detected integration on Continue"
  // behavior.
  const {activeIntegrationExisting} = useScmProviders();
  const effectiveIntegration = selectedIntegration ?? activeIntegrationExisting;

  return (
    <Stack align="center" gap="3xl" flexGrow={1}>
      <ScmStepHeader
        heading={t('Connect your code')}
        subtitle={t(
          'Linking a repo auto-detects your platform and unlocks stack trace linking, suspect commits, suggested assignees, and Seer.'
        )}
      />

      <LayoutGroup>
        <ScmIntegrationConnect
          analyticsFlow="onboarding"
          onClearDerivedState={onClearDerivedState}
          onIntegrationChange={onIntegrationChange}
          onRepositoryChange={onRepositoryChange}
          selectedIntegration={selectedIntegration}
          selectedRepository={selectedRepository}
        />
        <MotionFlex
          layout="position"
          gap="sm"
          align="center"
          width="100%"
          maxWidth={SCM_STEP_CONTENT_WIDTH}
        >
          <IconLock size="sm" variant="secondary" locked />
          <Text variant="secondary" size="md" density="comfortable">
            {t('Revoke any time from Settings / Integrations')}
          </Text>
        </MotionFlex>

        <MotionGrid
          columns={{'screen:xs': '1fr', 'screen:md': '1fr 1fr'}}
          gap="3xl"
          width="100%"
          maxWidth={SCM_STEP_CONTENT_WIDTH}
          layout="position"
          border="secondary"
          radius="xl"
          padding="2xl"
        >
          {SCM_INFO_SECTIONS.map(section => (
            <Stack key={section.title} gap="xl">
              <Flex align="center" gap="sm">
                <Text bold size="md" density="compressed" variant="primary">
                  {section.title}
                </Text>
                {section.tooltip && <InfoTip title={section.tooltip} size="sm" />}
              </Flex>
              <Stack gap="lg">
                {section.items.map(item => (
                  <Grid key={item} columns="max-content 1fr" gap="md">
                    <Flex paddingTop="2xs">{section.icon}</Flex>
                    <Text variant="primary" size="md" density="comfortable">
                      {item}
                    </Text>
                  </Grid>
                ))}
              </Stack>
            </Stack>
          ))}
        </MotionGrid>

        <MotionFlex
          layout="position"
          align="center"
          justify="between"
          width="100%"
          maxWidth={SCM_STEP_CONTENT_WIDTH}
          paddingTop="3xl"
        >
          <Flex align="center">{genBackButton?.()}</Flex>
          <Flex align="center" gap="md" minWidth={0}>
            {!selectedRepository && (
              <Button
                analyticsEventKey="onboarding.scm_connect_skip_clicked"
                analyticsEventName="Onboarding: SCM Connect Skip Clicked"
                analyticsParams={{
                  has_integration: !!effectiveIntegration,
                }}
                onClick={() => onComplete()}
                variant="transparent"
                style={{minWidth: 0}}
              >
                <Text ellipsis variant="inherit">
                  {t('Continue without a repo')}
                </Text>
              </Button>
            )}

            <Button
              variant="primary"
              analyticsEventKey="onboarding.scm_connect_continue_clicked"
              analyticsEventName="Onboarding: SCM Connect Continue Clicked"
              analyticsParams={{
                provider: effectiveIntegration?.provider.key ?? '',
                repo: selectedRepository?.name ?? '',
              }}
              onClick={() => {
                if (effectiveIntegration && !selectedIntegration) {
                  onIntegrationChange(effectiveIntegration);
                }
                onComplete();
              }}
              disabled={!selectedRepository?.id}
            >
              {t('Continue')}
            </Button>
          </Flex>
        </MotionFlex>
      </LayoutGroup>
    </Stack>
  );
}

const MotionFlex = motion.create(Flex);
const MotionGrid = motion.create(Grid);
