import {useMemo} from 'react';
import styled from '@emotion/styled';
import {AnimatePresence, motion} from 'framer-motion';

import {Flex} from '@sentry/scraps/layout';

import type {FilePatch} from 'sentry/components/events/autofix/types';
import {FileDiffViewer} from 'sentry/views/seerExplorer/fileDiffViewer';
import type {PendingUserInput} from 'sentry/views/seerExplorer/hooks/useSeerExplorer';

interface PendingFilePatch {
  patch: FilePatch;
  repo_name: string;
}

interface FileChangeApprovalData {
  patches: PendingFilePatch[];
}

interface FileChangeApprovalBlockProps {
  currentIndex: number;
  pendingInput: PendingUserInput;
  isFocused?: boolean;
  isLast?: boolean;
  onClick?: () => void;
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
}

function FileChangeApprovalBlock({
  currentIndex,
  isFocused,
  isLast,
  onClick,
  onMouseEnter,
  onMouseLeave,
  pendingInput,
}: FileChangeApprovalBlockProps) {
  const data = useMemo(() => {
    if (!pendingInput || pendingInput.input_type !== 'file_change_approval') {
      return null;
    }
    return pendingInput.data as FileChangeApprovalData;
  }, [pendingInput]);

  const patches = data?.patches ?? [];
  if (!patches || patches.length === 0 || currentIndex >= patches.length) {
    return null;
  }

  const currentPatch = patches[currentIndex]!;

  return (
    <Block
      isFocused={isFocused}
      isLast={isLast}
      onClick={onClick}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      <AnimatePresence>
        <motion.div
          initial={{opacity: 0, y: 10}}
          animate={{opacity: 1, y: 0}}
          exit={{opacity: 0, y: 10}}
        >
          <Flex align="start" width="100%">
            <BlockContentWrapper>
              <DiffScrollContainer>
                <AnimatePresence mode="wait">
                  <motion.div
                    key={currentIndex}
                    initial={{opacity: 0, x: 20}}
                    animate={{opacity: 1, x: 0}}
                    exit={{opacity: 0, x: -20}}
                    transition={{duration: 0.12, ease: 'easeOut'}}
                  >
                    <FileDiffViewer
                      patch={currentPatch.patch}
                      repoName={currentPatch.repo_name}
                      useFlexForDeleted
                    />
                  </motion.div>
                </AnimatePresence>
              </DiffScrollContainer>
            </BlockContentWrapper>
          </Flex>
        </motion.div>
      </AnimatePresence>
    </Block>
  );
}

export default FileChangeApprovalBlock;

const Block = styled('div')<{isFocused?: boolean; isLast?: boolean}>`
  width: 100%;
  border-bottom: ${p => (p.isLast ? 'none' : `1px solid ${p.theme.border}`)};
  position: relative;
  flex-shrink: 0;
  cursor: pointer;
  background: ${p =>
    p.isFocused ? p.theme.tokens.background.transparent.neutral.muted : 'transparent'};
`;

const BlockContentWrapper = styled('div')`
  flex: 1;
  min-width: 0;
  overflow: hidden;
`;

const DiffScrollContainer = styled('div')`
  overflow: auto;
`;
