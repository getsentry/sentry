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
import {useTopBarActionDisplay} from 'sentry/views/navigation/useTopBarActionDisplay';
import {useSeerExplorerContext} from 'sentry/views/seerExplorer/useSeerExplorerContext';

export function AskSeerButton() {
  const {isOpen, toggleSeerExplorer, sessionState: state} = useSeerExplorerContext();
  const {display: actionDisplay} = useTopBarActionDisplay();
  const showMessageIndicator = !isOpen && state === 'done-thinking';
  const prefersReducedMotion = useReducedMotion();
  const isIconOnly = actionDisplay === 'icon';

  return (
    <SeerButton
      variant="secondary"
      onClick={toggleSeerExplorer}
      aria-label={state === 'thinking' ? t('Seer is thinking...') : t('Ask Seer')}
      aria-expanded={isOpen ? true : undefined}
      tooltipProps={{
        title: (
          <Flex align="center" gap="sm">
            {t('Ask Seer')}
            <Hotkey value="command+/" />
          </Flex>
        ),
      }}
      icon={
        <Flex position="relative">
          <IconSeer
            variant={state === 'thinking' && prefersReducedMotion ? 'accent' : undefined}
            animation={
              showMessageIndicator
                ? 'waiting'
                : state === 'thinking'
                  ? 'loading'
                  : undefined
            }
          />
          {showMessageIndicator && isIconOnly ? <MessageIndicator /> : null}
        </Flex>
      }
    >
      {isIconOnly ? null : (
        <Flex position="relative">
          <Flex
            align="center"
            gap="sm"
            visibility={state === 'thinking' ? 'hidden' : undefined}
          >
            <Container>{t('Ask Seer')}</Container>
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
          {showMessageIndicator ? <MessageIndicator /> : null}
        </Flex>
      )}
    </SeerButton>
  );
}

function MessageIndicator() {
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

const SeerLoader = styled(Flex)`
  color: ${p => p.theme.tokens.graphics.accent.vibrant};
`;

const SeerButton = styled(Button)`
  > span:last-child {
    overflow: visible;
  }
`;
