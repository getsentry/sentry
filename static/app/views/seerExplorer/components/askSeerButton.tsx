import styled from '@emotion/styled';
import {useReducedMotion} from 'framer-motion';

import type {ButtonProps} from '@sentry/scraps/button';
import {Button} from '@sentry/scraps/button';
import {Hotkey} from '@sentry/scraps/hotkey';
import {Container, Flex} from '@sentry/scraps/layout';
import {IndeterminateLoader} from '@sentry/scraps/loader';
import {StatusIndicator} from '@sentry/scraps/statusIndicator';

import {IconSeer} from 'sentry/icons';
import {t} from 'sentry/locale';
import {useOrganization} from 'sentry/utils/useOrganization';
import {
  useSeerExplorerContext,
  type SeerExplorerSessionState,
} from 'sentry/views/seerExplorer/useSeerExplorerContext';
import {isSeerExplorerEnabled} from 'sentry/views/seerExplorer/utils';

export function AskSeerButton() {
  const organization = useOrganization({allowNull: true});
  const {isOpen, toggleSeerExplorer, sessionState: state} = useSeerExplorerContext();

  if (!organization || !isSeerExplorerEnabled(organization)) {
    return null;
  }

  const props: ButtonProps = {
    'aria-label': state === 'thinking' ? t('Seer is thinking...') : t('Ask Seer'),
    'aria-expanded': isOpen ? true : undefined,
    priority: 'default',
    icon: <MessageIndicator state={state} isOpen={isOpen} />,
  };

  return (
    <SeerButton {...props} onClick={toggleSeerExplorer}>
      <Flex position="relative">
        <Flex
          align="center"
          gap="sm"
          visibility={state === 'thinking' ? 'hidden' : undefined}
        >
          <Container>{t('Ask Seer')}</Container>
          <Hotkey value="command+/" variant="debossed" />
        </Flex>
        <ThinkingIndicator state={state} />
      </Flex>
    </SeerButton>
  );
}

interface IndicatorProps {
  state: SeerExplorerSessionState;
  isOpen?: boolean;
}

function ThinkingIndicator({state}: IndicatorProps) {
  const prefersReducedMotion = useReducedMotion();
  if (state !== 'thinking') {
    return null;
  }

  return (
    <SeerLoader
      position="absolute"
      inset="0"
      align="center"
      marginLeft="auto"
      marginRight="auto"
    >
      {prefersReducedMotion ? (
        t('Thinking...')
      ) : (
        <IndeterminateLoader variant="monochrome" />
      )}
    </SeerLoader>
  );
}

function MessageIndicator({state, isOpen = false}: IndicatorProps) {
  return (
    <Flex width="14px" align="center" justify="center">
      {!isOpen && state === 'done-thinking' ? (
        <StatusIndicator variant="accent" />
      ) : (
        <IconSeer />
      )}
    </Flex>
  );
}

const SeerLoader = styled(Flex)`
  color: ${p => p.theme.tokens.graphics.accent.vibrant};
`;

const SeerButton = styled(Button)`
  > span:last-child {
    overflow: visible;
  }
`;
