import {useState, type ReactNode} from 'react';
import styled from '@emotion/styled';

import {Container, Flex, Stack} from '@sentry/scraps/layout';
import {Heading, Text} from '@sentry/scraps/text';
import {SegmentedControl} from '@sentry/scraps/segmentedControl';

import {AgentHandoffProductPrompt} from 'sentry/components/agentHandoff/agentHandoffProductPrompt';
import type {AddFeatureProduct} from 'sentry/components/agentHandoff/useAgentHandoff';
import ProjectBadge from 'sentry/components/idBadge/projectBadge';
import {Benefit} from 'sentry/components/onboarding/benefit';
import {t, tct} from 'sentry/locale';
import type {Project} from 'sentry/types/project';

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
  /**
   * The illustration or media shown to the right of the intro text on large screens.
   */
  media: ReactNode;
  product: AddFeatureProduct;
  productName: string;
  project: Project;
  title: string;
  footer?: ReactNode;
  manualSetup?: ReactNode;
  onPromptCopied?: (handoffId: string) => void;
}

export function ProductEmptyState({
  agentSteps,
  benefits,
  feedbackSource,
  footer,
  media,
  manualSetup,
  onPromptCopied,
  product,
  productName,
  project,
  title,
}: ProductEmptyStateProps) {
  const [mode, setMode] = useState<SetupMode>('agent');
  const context = {product, projectId: project.id};

  return (
    <Stack gap="md" width="100%" maxWidth="960px" margin="0 auto">
      <Flex align="center" justify="between" gap="2xl" padding="3xl 2xl">
        <Stack gap="xl" flex={1}>
          <Heading as="h2" size="2xl">{title}</Heading>
          <Stack as="ul" role="list" gap="sm" padding="0" margin="0">
            {benefits.map(benefit => (
              <Benefit key={benefit} size="md">{benefit}</Benefit>
            ))}
          </Stack>
        </Stack>
        <Container
          display={{zero: 'none', xl: 'block'}}
          maxWidth="445px"
          flexShrink={0}
          pointerEvents="none"
        >
          {media}
        </Container>
      </Flex>

      <SetupCard>
        <SetupCardHeader>
          <Flex align="center" gap="sm">
            <Text bold>{tct('Set up [productName] for', {productName})}</Text>
            <ProjectBadge project={project} avatarSize={16} />
          </Flex>
          <SegmentedControl<SetupMode>
            value={mode}
            onChange={setMode}
            aria-label={t('Setup mode')}
          >
            <SegmentedControl.Item key="agent">{t('Use my coding agent')}</SegmentedControl.Item>
            <SegmentedControl.Item key="manual">{t('Set up manually')}</SegmentedControl.Item>
          </SegmentedControl>
        </SetupCardHeader>
        <SetupCardBody>
          {mode === 'agent' ? (
            <AgentHandoffProductPrompt
              agentSteps={agentSteps}
              context={context}
              feedbackSource={feedbackSource}
              onCopySuccess={onPromptCopied}
            />
          ) : (
            manualSetup
          )}
        </SetupCardBody>
      </SetupCard>

      {footer && <Container marginTop="md">{footer}</Container>}
    </Stack>
  );
}

const SetupCard = styled('div')`
  border: 1px solid ${p => p.theme.tokens.border.primary};
  border-radius: ${p => p.theme.radius.xl};
  overflow: hidden;
`;

const SetupCardHeader = styled('div')`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: ${p => p.theme.space.md};
  padding: ${p => p.theme.space.lg} ${p => p.theme.space['2xl']};
  background: ${p => p.theme.tokens.background.secondary};
  border-bottom: 1px solid ${p => p.theme.tokens.border.primary};
  flex-wrap: wrap;
`;

const SetupCardBody = styled('div')`
  padding: ${p => p.theme.space['2xl']};
`;
