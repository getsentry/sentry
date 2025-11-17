import {Fragment} from 'react';
import styled from '@emotion/styled';

// Match the Python types from notifications/platform/types.py
enum NotificationBodyFormattingBlockType {
  PARAGRAPH = 'paragraph',
  CODE_BLOCK = 'code_block',
}

enum NotificationBodyTextBlockType {
  PLAIN_TEXT = 'plain_text',
  BOLD_TEXT = 'bold_text',
  CODE = 'code',
}

interface NotificationBodyTextBlock {
  text: string;
  type: NotificationBodyTextBlockType;
}

export interface NotificationBodyFormattingBlock {
  blocks: NotificationBodyTextBlock[];
  type: NotificationBodyFormattingBlockType;
}

interface NotificationBodyRendererProps {
  body: NotificationBodyFormattingBlock[];
  codeBlockBackground?: string;
  codeBlockBorder?: string;
  codeBlockTextColor?: string;
}

function renderTextBlock(block: NotificationBodyTextBlock, index: number) {
  switch (block.type) {
    case NotificationBodyTextBlockType.PLAIN_TEXT:
      return <Fragment key={index}>{block.text} </Fragment>;
    case NotificationBodyTextBlockType.BOLD_TEXT:
      return <strong key={index}>{block.text} </strong>;
    case NotificationBodyTextBlockType.CODE:
      return <code key={index}>{block.text} </code>;
    default:
      return <Fragment key={index}>{block.text} </Fragment>;
  }
}

function renderFormattingBlock(
  block: NotificationBodyFormattingBlock,
  index: number,
  codeBlockBg: string,
  codeBlockBorder: string,
  codeBlockTextColor: string
) {
  if (block.type === NotificationBodyFormattingBlockType.PARAGRAPH) {
    return (
      <div key={index} style={{marginBottom: '8px'}}>
        {block.blocks.map((textBlock, i) => renderTextBlock(textBlock, i))}
      </div>
    );
  }
  if (block.type === NotificationBodyFormattingBlockType.CODE_BLOCK) {
    return (
      <div key={index} style={{marginBottom: '8px'}}>
        <StyledCodeBlock
          backgroundColor={codeBlockBg}
          borderColor={codeBlockBorder}
          textColor={codeBlockTextColor}
        >
          {block.blocks.map((textBlock, i) => renderTextBlock(textBlock, i))}
        </StyledCodeBlock>
      </div>
    );
  }
  return null;
}

const StyledCodeBlock = styled('code')<{
  backgroundColor: string;
  borderColor: string;
  textColor: string;
}>`
  display: block;
  padding: 12px;
  background-color: ${p => p.backgroundColor};
  border: 1px solid ${p => p.borderColor};
  border-radius: 6px;
  font-family: monospace;
  font-size: 13px;
  white-space: pre-wrap;
  word-break: break-word;
  color: ${p => p.textColor};
`;

export function NotificationBodyRenderer({
  body,
  codeBlockBackground = '#f6f8fa',
  codeBlockBorder = '#e1e4e8',
  codeBlockTextColor = '#24292e',
}: NotificationBodyRendererProps) {
  return (
    <div>
      {body.map((block, index) =>
        renderFormattingBlock(
          block,
          index,
          codeBlockBackground,
          codeBlockBorder,
          codeBlockTextColor
        )
      )}
    </div>
  );
}
