import {motion} from 'framer-motion';

import {Container} from '@sentry/scraps/layout';

import {unreachable} from 'sentry/utils/unreachable';
import type {Block} from 'sentry/views/seerExplorer/types';

import {AssistantBlock} from './assistant';
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

export function BlockComponent({onClick, ref, ...props}: BlockProps) {
  return (
    <Container
      width="100%"
      position="relative"
      flexShrink={0}
      data-block-wrapper=""
      ref={ref}
      onClick={onClick}
    >
      <motion.div initial={{opacity: 0, x: 10}} animate={{opacity: 1, x: 0}}>
        <BlockVariant {...props} />
      </motion.div>
    </Container>
  );
}

function BlockVariant(props: Omit<BlockProps, 'onClick' | 'ref'>) {
  const {block} = props;

  switch (block.message.role) {
    case 'user':
      return <UserBlock block={block} />;
    case 'tool_use':
      return (
        <ToolUseBlock
          block={block}
          blocks={props.blocks}
          getPageReferrer={props.getPageReferrer}
          showThinking={props.showThinking}
        />
      );
    case 'assistant':
      return (
        <AssistantBlock
          block={block}
          blockIndex={props.blockIndex}
          runId={props.runId}
          interactionPending={props.interactionPending}
          readOnly={props.readOnly}
        />
      );
    default: {
      unreachable(block.message.role);
      return null;
    }
  }
}
