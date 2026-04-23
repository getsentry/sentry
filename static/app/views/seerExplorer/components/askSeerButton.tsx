import type {PropsWithChildren} from 'react';
import styled from '@emotion/styled';

import type {ButtonProps} from '@sentry/scraps/button';
import {Button} from '@sentry/scraps/button';
import {Hotkey} from '@sentry/scraps/hotkey';
import {Flex} from '@sentry/scraps/layout';
import {IndeterminateLoader} from '@sentry/scraps/loader';
import {StatusIndicator} from '@sentry/scraps/statusIndicator';

import {IconSeer} from 'sentry/icons';
import {t} from 'sentry/locale';
import {useOrganization} from 'sentry/utils/useOrganization';
import {useSeerExplorerContext} from 'sentry/views/seerExplorer/useSeerExplorerContext';
import {isSeerExplorerEnabled} from 'sentry/views/seerExplorer/utils';

export function AskSeerButton() {
  const organization = useOrganization({allowNull: true});
  const {isOpen, toggleSeerExplorer, sessionState} = useSeerExplorerContext();

  if (!organization || !isSeerExplorerEnabled(organization)) {
    return null;
  }

  const visibility = sessionState === 'thinking' ? 'hidden' : undefined;

  const icon =
    !isOpen && sessionState === 'done-thinking' ? (
      <StatusIndicator variant="accent" />
    ) : (
      <IconSeer
        visibility={visibility}
        animation={sessionState === 'thinking' ? 'loading' : undefined}
      />
    );
  const props: ButtonProps = {
    'aria-label': sessionState === 'thinking' ? t('Seer is thinking...') : t('Ask Seer'),
    'aria-expanded': isOpen ? true : undefined,
    priority: 'default',
    icon: <IconWrapper>{icon}</IconWrapper>,
  };

  return (
    <SeerButton {...props} onClick={toggleSeerExplorer}>
      <Flex align="center" gap="sm" visibility={visibility}>
        {t('Ask Seer')}
        <Hotkey value="command+/" variant="debossed" />
      </Flex>
      {sessionState === 'thinking' ? (
        <SeerLoader position="absolute" inset="0" align="center">
          <IndeterminateLoader variant="monochrome" />
        </SeerLoader>
      ) : null}
    </SeerButton>
  );
}

function IconWrapper(props: PropsWithChildren) {
  return <Flex width="14px" align="center" justify="center" {...props} />;
}

const SeerLoader = styled(Flex)`
  color: ${p => p.theme.tokens.graphics.accent.vibrant};
`;

const SeerButton = styled(Button)`
  > span:last-child {
    overflow: visible;
  }
`;
