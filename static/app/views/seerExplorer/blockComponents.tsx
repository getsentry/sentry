import styled from '@emotion/styled';
import {AnimatePresence, motion} from 'framer-motion';

import {IconChevron} from 'sentry/icons';
import {space} from 'sentry/styles/space';

import type {Block} from './types';

interface BlockProps {
  block: Block;
  isFocused?: boolean;
  isLast?: boolean;
  onClick?: () => void;
  ref?: React.Ref<HTMLDivElement>;
}

function BlockComponent({block, isLast, isFocused, onClick, ref}: BlockProps) {
  return (
    <Block ref={ref} isLast={isLast} onClick={onClick}>
      <AnimatePresence>
        <motion.div
          initial={{opacity: 0, y: 10}}
          animate={{opacity: 1, y: 0}}
          exit={{opacity: 0, y: 10}}
        >
          {block.type === 'user-input' ? (
            <BlockRow>
              <BlockChevronIcon direction="right" size="sm" />
              <UserBlockContent>{block.content}</UserBlockContent>
            </BlockRow>
          ) : (
            <BlockRow>
              <ResponseDot isLoading={block.loading} />
              <BlockContent>{block.content}</BlockContent>
            </BlockRow>
          )}
          {isFocused && <FocusIndicator />}
        </motion.div>
      </AnimatePresence>
    </Block>
  );
}

BlockComponent.displayName = 'BlockComponent';

export default BlockComponent;

const Block = styled('div')<{isLast?: boolean}>`
  width: 100%;
  border-bottom: ${p => (p.isLast ? 'none' : `1px solid ${p.theme.border}`)};
  min-height: 40px;
  position: relative;
  flex-shrink: 0; /* Prevent blocks from shrinking */
  cursor: pointer;

  &:hover {
    background-color: ${p => p.theme.hover};
  }
`;

const BlockRow = styled('div')`
  display: flex;
  align-items: flex-start;
  width: 100%;
`;

const BlockChevronIcon = styled(IconChevron)`
  color: ${p => p.theme.subText};
  margin-top: 18px;
  margin-left: ${space(2)};
  margin-right: ${space(1)};
  flex-shrink: 0;
`;

const ResponseDot = styled('div')<{isLoading?: boolean}>`
  width: 8px;
  height: 8px;
  border-radius: 50%;
  margin-top: 22px;
  margin-left: ${space(2)};
  flex-shrink: 0;
  background: ${p => (p.isLoading ? p.theme.pink400 : p.theme.purple400)};

  ${p =>
    p.isLoading &&
    `
    animation: blink 1s infinite;

    @keyframes blink {
      0%, 50% { opacity: 1; }
      51%, 100% { opacity: 0.3; }
    }
  `}
`;

const BlockContent = styled('div')`
  width: 100%;
  padding: ${space(2)};
  line-height: 1.4;
  color: ${p => p.theme.textColor};
  white-space: pre-wrap;
  word-wrap: break-word;
`;

const UserBlockContent = styled('div')`
  width: 100%;
  padding: ${space(2)} ${space(2)} ${space(2)} 0;
  line-height: 1.4;
  white-space: pre-wrap;
  word-wrap: break-word;
  color: ${p => p.theme.subText};
`;

const FocusIndicator = styled('div')`
  position: absolute;
  top: 0;
  right: 0;
  bottom: 0;
  width: 3px;
  background: ${p => p.theme.pink400};
`;
