import {useEffect, useState, type ReactNode} from 'react';

import {Container, Flex, Stack} from '@sentry/scraps/layout';
import {SegmentedControl} from '@sentry/scraps/segmentedControl';
import {Heading, Text} from '@sentry/scraps/text';

import {AgentHandoffProductPrompt} from 'sentry/components/agentHandoff/agentHandoffProductPrompt';
import type {AddFeatureProduct} from 'sentry/components/agentHandoff/types';
import ProjectBadge from 'sentry/components/idBadge/projectBadge';
import {Benefit} from 'sentry/components/onboarding/benefit';
import {t, tct} from 'sentry/locale';
import type {Project} from 'sentry/types/project';
import {trackAnalytics} from 'sentry/utils/analytics';
import {useOrganization} from 'sentry/utils/useOrganization';

type SetupMode = 'agent' | 'manual';

interface ProductEmptyStateProps {
  /**
   * Short phrases for the "Your agent will:" list inside the agent tab.
   * Describe the agent's actions, not the product's value.
   */
  agentSteps: string[];
  /**
   * Short phrases shown as checkmark bullets in the intro section.
   * Describe the product's value, not the agent's actions.
   */
  benefits: string[];
  feedbackSource: string;
  manualSetup: ReactNode;
  /**
   * The illustration or media shown to the right of the intro text on large screens.
   */
  media: ReactNode;
  product: AddFeatureProduct;
  productName: string;
  project: Project;
  title: string;
  footer?: ReactNode;
}

export function ProductEmptyState({
  agentSteps,
  benefits,
  feedbackSource,
  footer,
  media,
  manualSetup,
  product,
  productName,
  project,
  title,
}: ProductEmptyStateProps) {
  const organization = useOrganization();
  const [mode, setMode] = useState<SetupMode>('agent');
  const context = {product, projectId: project.id};
  const platform = project.platform ?? 'unknown';

  useEffect(() => {
    trackAnalytics('product_empty_state.agent_setup_viewed', {
      organization,
      platform,
      product,
      project_id: project.id,
    });
  }, [organization, platform, product, project.id]);

  function handleModeChange(newMode: SetupMode) {
    setMode(newMode);
    trackAnalytics('product_empty_state.agent_setup_mode_selected', {
      organization,
      mode: newMode,
      product,
      project_id: project.id,
    });
  }

  function handleCopySuccess(handoffId: string) {
    trackAnalytics('product_empty_state.agent_setup_command_copied', {
      organization,
      handoff_id: handoffId,
      platform,
      product,
      project_id: project.id,
    });
  }

  return (
    <Stack gap="md" width="100%" maxWidth="960px" margin="0 auto">
      <Flex align="center" justify="between" gap="2xl" padding="3xl 2xl">
        <Stack gap="xl" flex={1}>
          <Heading as="h2" size="2xl">
            {title}
          </Heading>
          <Stack as="ul" role="list" gap="sm" padding="0" margin="0">
            {benefits.map(benefit => (
              <Benefit key={benefit}>{benefit}</Benefit>
            ))}
          </Stack>
        </Stack>
        <Container display={{zero: 'none', xl: 'block'}} maxWidth="445px" flexShrink={0}>
          {media}
        </Container>
      </Flex>

      <Stack gap="xl">
        <Container borderColor="primary" radius="xl" overflow="hidden">
          <Flex
            align="center"
            justify="between"
            gap="md"
            padding="lg 2xl"
            background="secondary"
            borderBottomColor="primary"
            wrap="wrap"
          >
            <Flex align="center" gap="sm">
              <Text bold>{tct('Set up [productName] for', {productName})}</Text>
              <ProjectBadge project={project} avatarSize={16} />
            </Flex>
            <SegmentedControl<SetupMode>
              value={mode}
              onChange={handleModeChange}
              aria-label={t('Setup mode')}
            >
              <SegmentedControl.Item key="agent">
                {t('Use my coding agent')}
              </SegmentedControl.Item>
              <SegmentedControl.Item key="manual">
                {t('Set up manually')}
              </SegmentedControl.Item>
            </SegmentedControl>
          </Flex>
          <Container padding="2xl">
            {mode === 'agent' ? (
              <AgentHandoffProductPrompt
                agentSteps={agentSteps}
                context={context}
                feedbackSource={feedbackSource}
                onCopySuccess={handleCopySuccess}
              />
            ) : (
              manualSetup
            )}
          </Container>
        </Container>
        {footer}
      </Stack>
    </Stack>
  );
}
