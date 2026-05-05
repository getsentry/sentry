import styled from '@emotion/styled';
import {useReducedMotion} from 'framer-motion';

import type {ButtonProps} from '@sentry/scraps/button';
import {Button} from '@sentry/scraps/button';
import {Hotkey} from '@sentry/scraps/hotkey';
import {Container, Flex} from '@sentry/scraps/layout';
import {IndeterminateLoader} from '@sentry/scraps/loader';
import {StatusIndicator} from '@sentry/scraps/statusIndicator';
import {Text} from '@sentry/scraps/text';

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
  const showMessageIndicator = useShowMessageIndicator({state, isOpen});

  if (!organization || !isSeerExplorerEnabled(organization)) {
    return null;
  }

  const props: ButtonProps = {
    'aria-label': state === 'thinking' ? t('Seer is thinking...') : t('Ask Seer'),
    'aria-expanded': isOpen ? true : undefined,
    variant: 'secondary',
    icon: (
      <IconSeer
        animation={
          showMessageIndicator ? 'waiting' : state === 'thinking' ? 'loading' : undefined
        }
      />
    ),
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
          <Container display={{xs: 'none', md: 'inline-block'}}>
            <Hotkey value="mod+/" variant="debossed" />
          </Container>
        </Flex>
        <ThinkingIndicator state={state} />
        <MessageIndicator state={state} isOpen={isOpen} />
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
        <Text variant="primary">{t('Thinking...')}</Text>
      ) : (
        <IndeterminateLoader variant="monochrome" />
      )}
    </SeerLoader>
  );
}

function MessageIndicator(props: IndicatorProps) {
  const shouldShow = useShowMessageIndicator(props);
  if (!shouldShow) {
    return null;
  }
  return (
    <Flex
      position="absolute"
      right="-6px"
      top="-2px"
      width="8px"
      height="8px"
      align="center"
      justify="center"
    >
      <StatusIndicator variant="accent" />
    </Flex>
  );
}

function useShowMessageIndicator({state, isOpen}: IndicatorProps): boolean {
  return !isOpen && state === 'done-thinking';
}

const SeerLoader = styled(Flex)`
  color: ${p => p.theme.tokens.graphics.accent.vibrant};
`;

const SeerButton = styled(Button)`
  > span:last-child {
    overflow: visible;
  }
`;
