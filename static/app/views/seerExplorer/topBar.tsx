import styled from '@emotion/styled';
import {AnimatePresence, motion} from 'framer-motion';

import {Button} from '@sentry/scraps/button';
import {Flex} from '@sentry/scraps/layout';

import {
  IconAdd,
  IconClose,
  IconContract,
  IconCopy,
  IconExpand,
  IconLink,
  IconMegaphone,
  IconSeer,
  IconTimer,
} from 'sentry/icons';
import {t} from 'sentry/locale';
import {toggleSeerExplorerPanel} from 'sentry/views/seerExplorer/utils';

interface TopBarProps {
  isCopyLinkEnabled: boolean;
  isCopySessionEnabled: boolean;
  isEmptyState: boolean;
  isMobile: boolean;
  isPolling: boolean;
  isSeerDrawerOpen: boolean;
  isSessionHistoryOpen: boolean;
  onCopyLinkClick: () => void;
  onCopySessionClick: () => void;
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
  isSeerDrawerOpen,
  isMobile,
  isSessionHistoryOpen,
  onFeedbackClick,
  onNewChatClick,
  onSessionHistoryClick,
  onCopySessionClick,
  onCopyLinkClick,
  onSizeToggleClick,
  panelSize,
  isCopySessionEnabled,
  isCopyLinkEnabled,
  sessionHistoryButtonRef,
}: TopBarProps) {
  return (
    <Flex
      align="center"
      justify="between"
      width="100%"
      borderBottom="primary"
      background="secondary"
      flexShrink={0}
      position="relative"
      data-seer-top-bar=""
    >
      <Flex>
        <Button
          icon={<IconAdd />}
          onClick={onNewChatClick}
          priority="transparent"
          size="sm"
          aria-label={t('Start a new chat (/new)')}
          tooltipProps={{title: t('Start a new chat (/new)')}}
        />
        <SessionHistoryButtonWrapper isSelected={isSessionHistoryOpen}>
          <Button
            ref={sessionHistoryButtonRef}
            icon={<IconTimer />}
            onClick={() => onSessionHistoryClick(sessionHistoryButtonRef)}
            priority="transparent"
            size="sm"
            aria-label={t('Resume a previous chat (/resume)')}
            tooltipProps={{title: t('Resume a previous chat (/resume)')}}
            aria-expanded={isSessionHistoryOpen}
          />
        </SessionHistoryButtonWrapper>
        <Button
          icon={<IconCopy />}
          onClick={onCopySessionClick}
          priority="transparent"
          size="sm"
          aria-label={t('Copy conversation to clipboard')}
          tooltipProps={{title: t('Copy conversation to clipboard')}}
          disabled={!isCopySessionEnabled}
        />
        <Button
          icon={<IconLink />}
          onClick={onCopyLinkClick}
          priority="transparent"
          size="sm"
          aria-label={t('Copy link to current chat and web page')}
          tooltipProps={{title: t('Copy link to current chat and web page')}}
          disabled={!isCopyLinkEnabled}
        />
      </Flex>
      <AnimatePresence initial={false}>
        {!isEmptyState && (
          <CenterSection
            key="seer-icon"
            initial={{opacity: 0, scale: 0.8, x: '-50%'}}
            animate={{opacity: 1, scale: 1, x: '-50%'}}
            exit={{opacity: 0, scale: 0.8, x: '-50%'}}
            transition={{duration: 0.12, ease: 'easeOut'}}
          >
            <IconSeer animation={isPolling ? 'loading' : 'waiting'} size="md" />
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
          tooltipProps={{title: t('Give the devs feedback (/feedback)')}}
        />
        <Button
          icon={panelSize === 'max' ? <IconContract /> : <IconExpand />}
          onClick={onSizeToggleClick}
          priority="transparent"
          size="sm"
          disabled={isSeerDrawerOpen || isMobile}
          aria-label={
            panelSize === 'max'
              ? t('Shrink to medium size (/med-size)')
              : t('Expand to full screen (/max-size)')
          }
          tooltipProps={{
            title:
              panelSize === 'max'
                ? t('Shrink to medium size (/med-size)')
                : t('Expand to full screen (/max-size)'),
          }}
        />
        <Button
          icon={<IconClose />}
          onClick={toggleSeerExplorerPanel}
          priority="transparent"
          size="sm"
          aria-label={t('Close panel')}
          tooltipProps={{title: t('Close panel')}}
        />
      </Flex>
    </Flex>
  );
}

export default TopBar;

const CenterSection = styled(motion.div)`
  position: absolute;
  left: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: ${p => p.theme.space.lg};
`;

const SessionHistoryButtonWrapper = styled('div')<{isSelected: boolean}>`
  button {
    background-color: ${p =>
      p.isSelected
        ? p.theme.tokens.interactive.transparent.neutral.background.active
        : 'transparent'};
  }
`;
