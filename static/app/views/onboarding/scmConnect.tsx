import {motion} from 'framer-motion';

import {Button} from '@sentry/scraps/button';
import {InfoText, InfoTip} from '@sentry/scraps/info';
import {Flex, Grid, Stack} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import {ScmIntegrationConnect} from 'sentry/components/onboarding/scm/scmIntegrationConnect';
import {ScmStepHeader} from 'sentry/components/onboarding/scm/scmStepHeader';
import {ScmStepLayout} from 'sentry/components/onboarding/scm/scmStepLayout';
import {useScmProviders} from 'sentry/components/onboarding/scm/useScmProviders';
import {IconCheckmark, IconClose, IconLock} from 'sentry/icons';
import {t} from 'sentry/locale';
import type {Integration, Repository} from 'sentry/types/integrations';

import {ONBOARDING_ENTER} from './animations';
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

interface ScmInfoItem {
  label: string;
  // Shown in a hover tooltip behind a dotted underline on the label.
  tooltip?: string;
}

const SCM_INFO_SECTIONS: Array<{
  icon: React.ReactNode;
  items: ScmInfoItem[];
  title: string;
  tooltip?: string;
}> = [
  {
    title: t('How we use repository access:'),
    icon: <IconCheckmark size="xs" variant="success" />,
    items: [
      {
        label: t('Source code context'),
        tooltip: t('Show code around errors'),
      },
      {
        label: t('Commit attribution'),
        tooltip: t('Identify which commit introduced an issue'),
      },
      {
        label: t('Auto assignment'),
        tooltip: t('Route issues by code ownership'),
      },
      {
        label: t('AI debugging'),
        tooltip: t('Connect code to telemetry to debug and fix issues'),
      },
    ],
  },
  {
    title: t('We will never (without your permission):'),
    tooltip: t(
      "If a feature needs more access to your code, we'll always ask you first. No surprises."
    ),
    icon: <IconClose size="xs" variant="danger" />,
    items: [
      {label: t('Train AI on your code')},
      {label: t('Merge code into your branches')},
      {label: t('Use your code for anything beyond debugging and support')},
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
    // The onboarding flow has no page-level query container (project creation
    // resolves against `#main`), and the flow's fixed footers preclude one
    // higher up, so each SCM step declares its own.
    <Stack containerType="inline-size">
      <ScmStepLayout>
        <ScmStepHeader
          heading={t('Connect your code')}
          subtitle={t(
            'Linking a repo auto-detects your platform and unlocks stack trace linking, suspect commits, suggested assignees, and Seer.'
          )}
        />

        {/* The note belongs to the control above it, so the two sit together
              rather than a step's worth of space apart. */}
        <MotionStack gap="md" width="100%" {...ONBOARDING_ENTER}>
          <ScmIntegrationConnect
            analyticsFlow="onboarding"
            onClearDerivedState={onClearDerivedState}
            onIntegrationChange={onIntegrationChange}
            onRepositoryChange={onRepositoryChange}
            selectedIntegration={selectedIntegration}
            selectedRepository={selectedRepository}
            pillsJustify="center"
          />

          {/* The provider buttons are the page's focus until one is
                connected; after that the note follows the repo picker's edge. */}
          <MotionFlex
            gap="sm"
            align="center"
            justify={effectiveIntegration ? 'start' : 'center'}
          >
            <IconLock size="sm" variant="secondary" locked />
            <Text variant="secondary" size="md" density="comfortable">
              {t('Revoke access any time in settings')}
            </Text>
          </MotionFlex>
        </MotionStack>

        <MotionGrid
          {...ONBOARDING_ENTER}
          columns="1fr"
          gap="2xl"
          width="100%"
          background="secondary"
          border="primary"
          radius="xl"
          padding="xl"
        >
          {SCM_INFO_SECTIONS.map(section => (
            <Stack key={section.title} gap="lg">
              <Flex align="center" gap="sm">
                <Text size="md" density="compressed" variant="primary">
                  {section.title}
                </Text>
                {section.tooltip && <InfoTip title={section.tooltip} size="sm" />}
              </Flex>
              <Flex wrap="wrap" gap="md 2xl">
                {section.items.map(item => (
                  <Grid key={item.label} columns="max-content 1fr" gap="md">
                    <Flex paddingTop="2xs">{section.icon}</Flex>
                    <Flex>
                      {item.tooltip ? (
                        <InfoText
                          title={item.tooltip}
                          variant="primary"
                          size="md"
                          density="comfortable"
                        >
                          {item.label}
                        </InfoText>
                      ) : (
                        <Text variant="primary" size="md" density="comfortable">
                          {item.label}
                        </Text>
                      )}
                    </Flex>
                  </Grid>
                ))}
              </Flex>
            </Stack>
          ))}
        </MotionGrid>

        <MotionFlex
          {...ONBOARDING_ENTER}
          align="center"
          justify="between"
          gap="md"
          width="100%"
          paddingTop="2xl"
        >
          <Flex align="center">{genBackButton?.()}</Flex>
          <Flex align="center" gap="md">
            <Button
              analyticsEventKey="onboarding.scm_connect_skip_clicked"
              analyticsEventName="Onboarding: SCM Connect Skip Clicked"
              analyticsParams={{
                has_integration: !!effectiveIntegration,
              }}
              onClick={() => onComplete()}
              variant="transparent"
            >
              {t('Continue without a repo')}
            </Button>

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
      </ScmStepLayout>
    </Stack>
  );
}

const MotionFlex = motion.create(Flex);
const MotionStack = motion.create(Stack);
const MotionGrid = motion.create(Grid);
