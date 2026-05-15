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
  getPageReferrer?: () => string;
  interactionPending?: boolean;
  onClick?: () => void;
  ref?: React.Ref<HTMLDivElement>;
  runId?: number;
}

export function BlockComponent({
  block,
  blockIndex,
  runId,
  getPageReferrer,
  interactionPending,
  onClick,
  ref,
}: BlockProps) {
  const contextValue = useMemo(
    () => ({block, blockIndex, getPageReferrer, interactionPending, runId}),
    [block, blockIndex, getPageReferrer, interactionPending, runId]
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

BlockComponent.displayName = 'BlockComponent';

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
