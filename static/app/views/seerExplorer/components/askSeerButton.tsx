import type {PropsWithChildren} from 'react';
import styled from '@emotion/styled';

import type {ButtonProps} from '@sentry/scraps/button';
import {Button} from '@sentry/scraps/button';
import {Flex} from '@sentry/scraps/layout';
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

  const icon =
    !isOpen && sessionState === 'done-thinking' ? (
      <StatusIndicator variant="accent" />
    ) : (
      <IconSeer animation={sessionState === 'thinking' ? 'loading' : undefined} />
    );
  const props: ButtonProps = {
    'aria-label': t('Ask Seer'),
    'aria-expanded': isOpen ? true : undefined,
    priority: sessionState === 'thinking' ? 'primary' : 'default',
    icon: <IconWrapper>{icon}</IconWrapper>,
  };

  return (
    <SeerButton {...props} onClick={toggleSeerExplorer}>
      {t('Ask Seer')}
    </SeerButton>
  );
}

function IconWrapper(props: PropsWithChildren) {
  return <Flex width="14px" align="center" justify="center" {...props} />;
}

const SeerButton = styled(Button)`
  > span:last-child {
    overflow: visible;
  }
`;
