import styled from '@emotion/styled';
import {AnimatePresence, motion} from 'framer-motion';

import {Button} from '@sentry/scraps/button';
import {Flex} from '@sentry/scraps/layout';

import {
  IconAdd,
  IconContract,
  IconExpand,
  IconMegaphone,
  IconSeer,
  IconTimer,
} from 'sentry/icons';
import {t} from 'sentry/locale';

interface TopBarProps {
  isEmptyState: boolean;
  isPolling: boolean;
  isSessionHistoryOpen: boolean;
  onFeedbackClick: () => void;
  onNewChatClick: () => void;
  onSessionHistoryClick: (buttonRef: React.RefObject<HTMLElement | null>) => void;
  onSizeToggleClick: () => void;
  panelSize: 'max' | 'med';
  sessionHistoryButtonRef: React.RefObject<HTMLButtonElement | null>;
}

function TopBar({
  isPolling,
  isEmptyState,
  isSessionHistoryOpen,
  onFeedbackClick,
  onNewChatClick,
  onSessionHistoryClick,
  onSizeToggleClick,
  panelSize,
  sessionHistoryButtonRef,
}: TopBarProps) {
  return (
    <TopBarContainer data-seer-top-bar="">
      <Flex>
        <Button
          icon={<IconAdd />}
          onClick={onNewChatClick}
          priority="transparent"
          size="sm"
          aria-label={t('Start a new chat (/new)')}
          title={t('Start a new chat (/new)')}
        />
        <SessionHistoryButtonWrapper isSelected={isSessionHistoryOpen}>
          <Button
            ref={sessionHistoryButtonRef}
            icon={<IconTimer />}
            onClick={() => onSessionHistoryClick(sessionHistoryButtonRef)}
            priority="transparent"
            size="sm"
            aria-label={t('Resume a previous chat (/resume)')}
            title={t('Resume a previous chat (/resume)')}
            aria-expanded={isSessionHistoryOpen}
          />
        </SessionHistoryButtonWrapper>
      </Flex>
      <AnimatePresence initial={false}>
        {!isEmptyState && (
          <CenterSection
            key="seer-icon"
            initial={{opacity: 0, scale: 0.8}}
            animate={{opacity: 1, scale: 1}}
            exit={{opacity: 0, scale: 0.8}}
            transition={{duration: 0.12, ease: 'easeOut'}}
          >
            <IconSeer variant={isPolling ? 'loading' : 'waiting'} size="md" />
          </CenterSection>
        )}
      </AnimatePresence>
      <Flex>
        <Button
          icon={<IconMegaphone />}
          onClick={onFeedbackClick}
          priority="transparent"
          size="sm"
          aria-label={t('Give the devs feedback (/feedback)')}
          title={t('Give the devs feedback (/feedback)')}
        />
        <Button
          icon={panelSize === 'max' ? <IconContract /> : <IconExpand />}
          onClick={onSizeToggleClick}
          priority="transparent"
          size="sm"
          aria-label={
            panelSize === 'max'
              ? t('Shrink to medium size (/med-size)')
              : t('Expand to full screen (/max-size)')
          }
          title={
            panelSize === 'max'
              ? t('Shrink to medium size (/med-size)')
              : t('Expand to full screen (/max-size)')
          }
        />
      </Flex>
    </TopBarContainer>
  );
}

export default TopBar;

const TopBarContainer = styled('div')`
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  border-bottom: 1px solid ${p => p.theme.border};
  background: ${p => p.theme.backgroundSecondary};
  flex-shrink: 0;
`;

const CenterSection = styled(motion.div)`
  display: flex;
  align-items: center;
  justify-content: center;
  flex: 1;
`;

const SessionHistoryButtonWrapper = styled('div')<{isSelected: boolean}>`
  button {
    background-color: ${p => (p.isSelected ? p.theme.hover : 'transparent')};
  }
`;
