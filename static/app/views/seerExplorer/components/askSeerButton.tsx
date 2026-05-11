import styled from '@emotion/styled';
import {useReducedMotion} from 'framer-motion';

import {Button} from '@sentry/scraps/button';
import {Hotkey} from '@sentry/scraps/hotkey';
import {Container, Flex} from '@sentry/scraps/layout';
import {IndeterminateLoader} from '@sentry/scraps/loader';
import {StatusIndicator} from '@sentry/scraps/statusIndicator';
import {Text} from '@sentry/scraps/text';

import {IconSeer} from 'sentry/icons';
import {t} from 'sentry/locale';
import {useSeerExplorerContext} from 'sentry/views/seerExplorer/useSeerExplorerContext';

export function AskSeerButton() {
  const {isOpen, toggleSeerExplorer, sessionState: state} = useSeerExplorerContext();
  const showMessageIndicator = !isOpen && state === 'done-thinking';
  const prefersReducedMotion = useReducedMotion();

  return (
    <SeerButton
      variant="secondary"
      onClick={toggleSeerExplorer}
      aria-label={state === 'thinking' ? t('Seer is thinking...') : t('Ask Seer')}
      aria-expanded={isOpen ? true : undefined}
      icon={
        <IconSeer
          animation={
            showMessageIndicator
              ? 'waiting'
              : state === 'thinking'
                ? 'loading'
                : undefined
          }
        />
      }
    >
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
        {state === 'thinking' ? (
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
        ) : null}
        {showMessageIndicator ? (
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
        ) : null}
      </Flex>
    </SeerButton>
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
