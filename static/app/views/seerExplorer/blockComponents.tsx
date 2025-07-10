import styled from '@emotion/styled';
import {AnimatePresence, motion} from 'framer-motion';

import {IconChevron} from 'sentry/icons';
import {space} from 'sentry/styles/space';
import {MarkedText} from 'sentry/utils/marked/markedText';

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
              <BlockContent text={block.content} />
            </BlockRow>
          )}
          {isFocused && <FocusIndicator />}
          {isFocused && <DeleteHint>Rethink from here ⌫</DeleteHint>}
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

const BlockContent = styled(MarkedText)`
  width: 100%;
  padding: ${space(2)};
  color: ${p => p.theme.textColor};
  white-space: pre-wrap;
  word-wrap: break-word;

  p,
  li,
  ul {
    margin: -${space(1)} 0;
  }

  h1,
  h2,
  h3,
  h4,
  h5,
  h6 {
    margin: 0;
    font-size: ${p => p.theme.fontSize.lg};
  }

  p:first-child,
  li:first-child,
  ul:first-child,
  h1:first-child,
  h2:first-child,
  h3:first-child,
  h4:first-child,
  h5:first-child,
  h6:first-child {
    margin-top: 0;
  }
`;

const UserBlockContent = styled('div')`
  width: 100%;
  padding: ${space(2)} ${space(2)} ${space(2)} 0;
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

const DeleteHint = styled('div')`
  position: absolute;
  bottom: ${space(0.5)};
  right: ${space(1)};
  padding: ${space(0.25)} ${space(0.5)};
  font-size: 10px;
  color: ${p => p.theme.subText};
  box-shadow: ${p => p.theme.dropShadowLight};
  pointer-events: none;
  white-space: nowrap;
`;
