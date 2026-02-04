import styled from '@emotion/styled';
import {AnimatePresence, motion} from 'framer-motion';

import {Flex} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import HotkeysLabel from 'sentry/components/hotkeysLabel';
import {IconSeer} from 'sentry/icons';
import {t} from 'sentry/locale';

interface AskSeerFabProps {
  hide: boolean;
  onOpen: () => void;
}

function SeerFab({hide, onOpen}: AskSeerFabProps) {
  return (
    <AnimatePresence>
      {!hide && (
        <FloatingActionButton
          initial={{opacity: 0, scale: 0.9, y: 20}}
          animate={{opacity: 1, scale: 1, y: 0}}
          exit={{opacity: 0, scale: 0.9, y: 20}}
          transition={{duration: 0.2, ease: [0.4, 0, 0.2, 1]}}
          onClick={onOpen}
        >
          <Flex align="center" gap="sm">
            <IconSeer size="sm" />
            <Text size="sm">{t('Ask Seer')}</Text>
            <Text size="xs" variant="muted">
              <HotkeysLabel value={['command+/', 'ctrl+/']} />
            </Text>
          </Flex>
        </FloatingActionButton>
      )}
    </AnimatePresence>
  );
}

export default SeerFab;

const FloatingActionButton = styled(motion.button)`
  position: fixed;
  bottom: ${p => p.theme.space.lg};
  right: ${p => p.theme.space.lg};
  z-index: 9999;
  padding: ${p => p.theme.space.sm} ${p => p.theme.space.md};
  background: ${p => p.theme.tokens.background.primary};
  border: 1px solid ${p => p.theme.tokens.border.primary};
  border-radius: ${p => p.theme.radius.md};
  box-shadow: ${p => p.theme.dropShadowHeavy};
  cursor: pointer;

  &:hover {
    background: ${p => p.theme.tokens.background.secondary};
  }

  &:active {
    transform: scale(0.98);
  }
`;
