import {useMemo} from 'react';
import {motion} from 'framer-motion';

import {unreachable} from 'sentry/utils/unreachable';
import type {Block} from 'sentry/views/seerExplorer/types';

import {AssistantBlock} from './assistant';
import {BlockContext, BlockWrapper, useBlockContext} from './shared';
import {ToolUseBlock} from './toolUse';
import {UserBlock} from './user';

interface BlockProps {
  block: Block;
  blockIndex: number;
  blocks?: Block[];
  getPageReferrer?: () => string;
  interactionPending?: boolean;
  onClick?: () => void;
  readOnly?: boolean;
  ref?: React.Ref<HTMLDivElement>;
  runId?: number;
  showThinking?: boolean;
}

export function BlockComponent({
  block,
  blockIndex,
  blocks,
  runId,
  getPageReferrer,
  interactionPending,
  readOnly,
  showThinking,
  onClick,
  ref,
}: BlockProps) {
  const contextValue = useMemo(
    () => ({
      block,
      blockIndex,
      blocks,
      getPageReferrer,
      interactionPending,
      readOnly,
      runId,
      showThinking,
    }),
    [
      block,
      blockIndex,
      blocks,
      getPageReferrer,
      interactionPending,
      readOnly,
      runId,
      showThinking,
    ]
  );

  return (
    <BlockContext.Provider value={contextValue}>
      <BlockWrapper ref={ref} onClick={onClick}>
        <motion.div initial={{opacity: 0, x: 10}} animate={{opacity: 1, x: 0}}>
          <BlockVariant />
        </motion.div>
      </BlockWrapper>
    </BlockContext.Provider>
  );
}

function BlockVariant() {
  const {block} = useBlockContext();

  switch (block.message.role) {
    case 'user':
      return <UserBlock />;
    case 'tool_use':
      return <ToolUseBlock />;
    case 'assistant':
      return <AssistantBlock />;
    default: {
      unreachable(block.message.role);
      return null;
    }
  }
}
