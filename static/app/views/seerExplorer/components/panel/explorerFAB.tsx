import {createPortal} from 'react-dom';
import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';
import {AnimatePresence, motion} from 'framer-motion';

import {Button} from '@sentry/scraps/button';
import {Hotkey} from '@sentry/scraps/hotkey';
import {Container, Flex} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import {IconSeer} from 'sentry/icons';
import {t} from 'sentry/locale';
import {useOrganization} from 'sentry/utils/useOrganization';
import {useSeerExplorerContext} from 'sentry/views/seerExplorer/useSeerExplorerContext';
import {isSeerExplorerEnabled} from 'sentry/views/seerExplorer/utils';

/**
 * Backwards compatibility component for opening Seer Explorer Drawer when page frame is disabled.
 */
export function ExplorerFloatingActionButton() {
  const organization = useOrganization({allowNull: true});
  const {openSeerExplorer, isOpen: isSeerExplorerDrawerOpen} = useSeerExplorerContext();

  if (!organization || !isSeerExplorerEnabled(organization)) {
    return null;
  }

  return createPortal(
    <SeerFloatingActionButton
      visible={!isSeerExplorerDrawerOpen}
      onClick={() => openSeerExplorer()}
    />,
    document.body
  );
}

const MotionButton = motion.create(Button);

interface SeerFloatingActionButtonProps extends React.ComponentProps<
  typeof MotionButton
> {
  visible: boolean;
}

function SeerFloatingActionButton(props: SeerFloatingActionButtonProps) {
  const {visible, ...rest} = props;
  const theme = useTheme();

  return (
    <AnimatePresence>
      {visible && (
        <Container
          position="fixed"
          bottom={theme.space.lg}
          right={theme.space.lg}
          style={{zIndex: theme.zIndex.sidebarPanel}}
        >
          <SeerButton
            initial={{opacity: 0, scale: 0.9, y: 20}}
            animate={{opacity: 1, scale: 1, y: 0}}
            exit={{opacity: 0, scale: 0.9, y: 20}}
            transition={{duration: 0.2, ease: [0.4, 0, 0.2, 1]}}
            size="sm"
            {...rest}
            icon={<IconSeer />}
          >
            <Flex align="center" gap="sm">
              <Text size="sm">{t('Ask Seer')}</Text>
              <Hotkey variant="debossed" value="mod+/" />
            </Flex>
          </SeerButton>
        </Container>
      )}
    </AnimatePresence>
  );
}

const SeerButton = styled(MotionButton)`
  & > span:last-child {
    overflow: visible;
  }
`;
