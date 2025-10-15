import {useEffect, useRef, useState} from 'react';
import styled from '@emotion/styled';
import {AnimatePresence, motion} from 'framer-motion';

import {Button} from 'sentry/components/core/button';
import {ButtonBar} from 'sentry/components/core/button/buttonBar';
import {Stack} from 'sentry/components/core/layout';
import {Text} from 'sentry/components/core/text';
import {IconChevron} from 'sentry/icons';
import {space} from 'sentry/styles/space';
import {MarkedText} from 'sentry/utils/marked/markedText';
import {useNavigate} from 'sentry/utils/useNavigate';
import useOrganization from 'sentry/utils/useOrganization';

import type {Block} from './types';
import {buildToolLinkUrl, getToolsStringFromBlock} from './utils';

interface BlockProps {
  block: Block;
  blockIndex: number;
  isFocused?: boolean;
  isLast?: boolean;
  onClick?: () => void;
  onDelete?: () => void;
  onNavigate?: () => void;
  onRegisterEnterHandler?: (
    handler: (key: 'Enter' | 'ArrowUp' | 'ArrowDown') => boolean
  ) => void;
  ref?: React.Ref<HTMLDivElement>;
}

function hasValidContent(content: string): boolean {
  if (!content) {
    return false;
  }
  const trimmed = content.trim();
  return trimmed.length > 0 && trimmed !== '.'; // sometimes the LLM just says '.' when calling a tool
}

function BlockComponent({
  block,
  blockIndex: _blockIndex,
  isLast,
  isFocused,
  onClick,
  onDelete,
  onNavigate,
  onRegisterEnterHandler,
  ref,
}: BlockProps) {
  const organization = useOrganization();
  const navigate = useNavigate();
  const toolsUsed = getToolsStringFromBlock(block);
  const hasTools = toolsUsed.length > 0;
  const hasContent = hasValidContent(block.message.content);

  // State to track selected tool link (for navigation)
  const [selectedLinkIndex, setSelectedLinkIndex] = useState(0);
  const selectedLinkIndexRef = useRef(selectedLinkIndex);

  // Keep ref in sync with state
  useEffect(() => {
    selectedLinkIndexRef.current = selectedLinkIndex;
  }, [selectedLinkIndex]);

  // Get valid tool links with their corresponding tool call indices
  const validToolLinksWithIndices = (block.tool_links || [])
    .map(link => {
      const toolCallIndex = block.message.tool_calls?.findIndex(
        call => link && call.function === link.kind
      );
      const canBuildUrl = link && buildToolLinkUrl(link, organization.slug) !== null;

      if (toolCallIndex !== undefined && toolCallIndex >= 0 && canBuildUrl) {
        return {link, toolCallIndex};
      }
      return null;
    })
    .filter(
      (
        item
      ): item is {
        link: {kind: string; params: Record<string, any>};
        toolCallIndex: number;
      } => item !== null
    );

  const validToolLinks = validToolLinksWithIndices.map(item => item.link);
  const hasValidLinks = validToolLinks.length > 0;

  // Reset selected index when block changes or when there are no valid links
  useEffect(() => {
    if (!hasValidLinks) {
      setSelectedLinkIndex(0);
    } else if (selectedLinkIndex >= validToolLinks.length) {
      setSelectedLinkIndex(0);
    }
  }, [hasValidLinks, selectedLinkIndex, validToolLinks.length]);

  // Register the key handler with the parent
  useEffect(() => {
    const handler = (key: 'Enter' | 'ArrowUp' | 'ArrowDown') => {
      if (!hasValidLinks) {
        return false;
      }

      if (key === 'ArrowUp') {
        // Move to previous link
        const currentIndex = selectedLinkIndexRef.current;
        if (currentIndex > 0) {
          // Can move up within this block's links
          setSelectedLinkIndex(prev => prev - 1);
          return true;
        }
        // At the first link, let navigation move to previous block
        return false;
      }

      if (key === 'ArrowDown') {
        // Move to next link
        const currentIndex = selectedLinkIndexRef.current;
        if (currentIndex < validToolLinks.length - 1) {
          // Can move down within this block's links
          setSelectedLinkIndex(prev => prev + 1);
          return true;
        }
        // At the last link, let navigation move to next block
        return false;
      }

      if (key === 'Enter') {
        // Navigate to selected link using ref to get current value
        const currentIndex = selectedLinkIndexRef.current;
        const selectedLink = validToolLinks[currentIndex];
        if (selectedLink) {
          const url = buildToolLinkUrl(selectedLink, organization.slug);
          if (url) {
            navigate(url);
          }
        }
        return true;
      }
      return false;
    };

    onRegisterEnterHandler?.(handler);
  }, [
    hasValidLinks,
    validToolLinks,
    organization.slug,
    navigate,
    onRegisterEnterHandler,
  ]);

  const handleDeleteClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onDelete?.();
  };

  const handleNavigateClick = (e: React.MouseEvent, linkIndex: number) => {
    e.stopPropagation();
    if (validToolLinks.length === 0) {
      return;
    }

    // Navigate to the clicked link
    const selectedLink = validToolLinks[linkIndex];
    if (selectedLink) {
      const url = buildToolLinkUrl(selectedLink, organization.slug);
      if (url) {
        navigate(url);
        onNavigate?.();
      }
    }
  };

  return (
    <Block ref={ref} isLast={isLast} onClick={onClick}>
      <AnimatePresence>
        <motion.div
          initial={{opacity: 0, y: 10}}
          animate={{opacity: 1, y: 0}}
          exit={{opacity: 0, y: 10}}
        >
          {block.message.role === 'user' ? (
            <BlockRow>
              <BlockChevronIcon direction="right" size="sm" />
              <UserBlockContent>{block.message.content ?? ''}</UserBlockContent>
            </BlockRow>
          ) : (
            <BlockRow>
              <ResponseDot
                isLoading={block.loading}
                hasOnlyTools={!hasContent && hasTools}
              />
              <BlockContentWrapper hasOnlyTools={!hasContent && hasTools}>
                {hasContent && <BlockContent text={block.message.content} />}
                {hasTools && (
                  <Stack gap="md">
                    {block.message.tool_calls?.map((toolCall, idx) => {
                      const toolString = toolsUsed[idx];
                      return (
                        <Text
                          key={`${toolCall.function}-${idx}`}
                          size="xs"
                          variant="muted"
                          monospace
                        >
                          {toolString}
                        </Text>
                      );
                    })}
                  </Stack>
                )}
              </BlockContentWrapper>
            </BlockRow>
          )}
          {isFocused && <FocusIndicator />}
          {isFocused && !block.loading && (
            <ActionButtonBar gap="sm">
              <Button size="xs" priority="default" onClick={handleDeleteClick}>
                Rethink from here ⌫
              </Button>
              {hasValidLinks && (
                <ButtonBar merged gap="0">
                  {validToolLinks.map((_, idx) => (
                    <Button
                      key={idx}
                      size="xs"
                      priority={idx === selectedLinkIndex ? 'primary' : 'default'}
                      onClick={e => handleNavigateClick(e, idx)}
                    >
                      {idx === 0
                        ? validToolLinks.length === 1
                          ? 'Navigate'
                          : 'Navigate #1'
                        : `#${idx + 1}`}
                      {idx === selectedLinkIndex && ' ⏎'}
                    </Button>
                  ))}
                </ButtonBar>
              )}
            </ActionButtonBar>
          )}
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

const ResponseDot = styled('div')<{hasOnlyTools?: boolean; isLoading?: boolean}>`
  width: 8px;
  height: 8px;
  border-radius: 50%;
  margin-top: ${p => (p.hasOnlyTools ? '12px' : '22px')};
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

const BlockContentWrapper = styled('div')<{hasOnlyTools?: boolean}>`
  padding: ${p =>
    p.hasOnlyTools ? `${p.theme.space.md} ${p.theme.space.xl}` : p.theme.space.xl};
`;

const BlockContent = styled(MarkedText)`
  width: 100%;
  color: ${p => p.theme.textColor};
  white-space: pre-wrap;
  word-wrap: break-word;
  padding-bottom: 0;
  margin-bottom: -${space(1)};

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
  background: ${p => p.theme.purple400};
`;

const ActionButtonBar = styled(ButtonBar)`
  position: absolute;
  bottom: ${p => p.theme.space['2xs']};
  right: ${p => p.theme.space.md};
  white-space: nowrap;
  font-size: ${p => p.theme.fontSize.sm};
  background: ${p => p.theme.background};
`;
