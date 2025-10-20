import {Fragment, type ReactNode} from 'react';
import styled from '@emotion/styled';
import {AnimatePresence, motion} from 'framer-motion';

import {Button} from 'sentry/components/core/button';
import {Flex} from 'sentry/components/core/layout';
import {Heading} from 'sentry/components/core/text/heading';
import {IconClose} from 'sentry/icons';
import {t} from 'sentry/locale';

interface InsightInfoModalProps {
  children: ReactNode;
  isOpen: boolean;
  onClose: () => void;
  title: string;
}

export function InsightInfoModal({
  isOpen,
  onClose,
  title,
  children,
}: InsightInfoModalProps) {
  if (!isOpen) {
    return null;
  }

  return (
    <Fragment>
      <AnimatePresence>
        {isOpen && (
          <Fragment>
            <Backdrop
              key="insight-modal-backdrop"
              initial={{opacity: 0}}
              animate={{opacity: 1}}
              exit={{opacity: 0}}
              transition={{duration: 0.2}}
              onClick={onClose}
            />
            <ModalContainer
              key="insight-modal-content"
              initial={{opacity: 0, scale: 0.95, x: '-50%', y: '-50%'}}
              animate={{opacity: 1, scale: 1, x: '-50%', y: '-50%'}}
              exit={{opacity: 0, scale: 0.95, x: '-50%', y: '-50%'}}
              transition={{duration: 0.2}}
              onClick={e => e.stopPropagation()}
            >
              <Flex direction="column" gap="lg" style={{width: '100%', minWidth: 0}}>
                <Flex justify="between" align="center">
                  <Heading as="h2" size="lg">
                    {title}
                  </Heading>
                  <Button
                    size="sm"
                    icon={<IconClose />}
                    aria-label={t('Close modal')}
                    onClick={onClose}
                  />
                </Flex>

                <Flex direction="column" gap="md" style={{minWidth: 0}}>
                  {children}
                </Flex>
              </Flex>
            </ModalContainer>
          </Fragment>
        )}
      </AnimatePresence>
    </Fragment>
  );
}

const Backdrop = styled(motion.div)`
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  background: rgba(0, 0, 0, 0.5);
  z-index: 10000;
  pointer-events: auto;
`;

const ModalContainer = styled(motion.div)`
  position: fixed;
  top: 50%;
  left: 50%;
  width: 90%;
  max-width: 700px;
  height: auto;
  background: ${p => p.theme.background};
  border: 1px solid ${p => p.theme.border};
  border-radius: ${p => p.theme.borderRadius};
  padding: ${p => p.theme.space.xl};
  z-index: 10001;
  box-shadow: ${p => p.theme.dropShadowHeavy};
  display: flex;
  overflow: hidden;
`;

export const CodeBlockWrapper = styled('div')`
  max-height: 300px;
  overflow: auto;
  min-width: 0;
  width: 100%;
  padding: ${p => p.theme.space.sm} 0;
`;

export const Code = styled('code')`
  background: ${p => p.theme.backgroundSecondary};
  padding: ${p => p.theme.space.xs} ${p => p.theme.space.sm};
  border-radius: ${p => p.theme.borderRadius};
  font-family: ${p => p.theme.text.familyMono};
  font-size: ${p => p.theme.fontSize.sm};
  color: ${p => p.theme.purple300};
`;

export const OrderedList = styled('ol')`
  margin: 0;
  padding-left: ${p => p.theme.space.xl};
  display: flex;
  flex-direction: column;
  gap: ${p => p.theme.space.sm};

  li {
    color: ${p => p.theme.textColor};
  }
`;
