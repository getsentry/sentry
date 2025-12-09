import styled from '@emotion/styled';
import {motion, type MotionNodeAnimationOptions} from 'framer-motion';

import {Text} from 'sentry/components/core/text';
import {IconSeer} from 'sentry/icons';
import {t} from 'sentry/locale';
import testableTransition from 'sentry/utils/testableTransition';
import type {Block} from 'sentry/views/seerExplorer/types';
import {getToolsStringFromBlock} from 'sentry/views/seerExplorer/utils';

interface ExplorerStatusCardProps {
  /**
   * Current status of the autofix run.
   */
  status: 'processing' | 'completed' | 'error' | 'awaiting_user_input';
  /**
   * The currently loading block (if any).
   */
  loadingBlock?: Block;
  /**
   * Optional click handler (e.g. to open the chat).
   */
  onClick?: () => void;
}

const cardAnimationProps: MotionNodeAnimationOptions = {
  exit: {opacity: 0, height: 0, scale: 0.8, y: -20},
  initial: {opacity: 0, height: 0, scale: 0.8},
  animate: {opacity: 1, height: 'auto', scale: 1},
  transition: testableTransition({
    duration: 0.1,
    height: {
      type: 'spring',
      bounce: 0.2,
    },
    scale: {
      type: 'spring',
      bounce: 0.2,
    },
    y: {
      type: 'tween',
      ease: 'easeOut',
    },
  }),
};

/**
 * Status card shown when the autofix run is processing.
 *
 * Displays a loading indicator and the latest tool action or message from the agent.
 */
export function ExplorerStatusCard({
  status,
  loadingBlock,
  onClick,
}: ExplorerStatusCardProps) {
  if (status !== 'processing') {
    return null;
  }

  // Get tool strings if the block has tool calls
  const toolStrings = loadingBlock ? getToolsStringFromBlock(loadingBlock) : [];

  // Show tool string if available, otherwise message content, otherwise default
  const displayText =
    toolStrings.length > 0
      ? toolStrings[toolStrings.length - 1]
      : loadingBlock?.message?.content || t('Analyzing...');

  return (
    <AnimatedCard {...cardAnimationProps}>
      <Container onClick={onClick} clickable={!!onClick}>
        <IconSeer variant="loading" size="lg" />
        <Text size="md" ellipsis>
          {displayText}
        </Text>
      </Container>
    </AnimatedCard>
  );
}

const AnimatedCard = styled(motion.div)`
  transform-origin: top center;
`;

const Container = styled('div')<{clickable?: boolean}>`
  display: flex;
  align-items: center;
  gap: ${p => p.theme.space.lg};
  padding: ${p => p.theme.space.xl};
  background: ${p => p.theme.backgroundElevated};
  border: 1px solid ${p => p.theme.border};
  border-radius: ${p => p.theme.borderRadius};
  margin-bottom: ${p => p.theme.space.xl};
  ${p =>
    p.clickable &&
    `
    cursor: pointer;
    &:hover {
      background: ${p.theme.hover};
    }
  `}
`;
