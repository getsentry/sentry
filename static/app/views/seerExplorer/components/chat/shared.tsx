import {createContext, Fragment, useContext} from 'react';
import {keyframes} from '@emotion/react';
import styled from '@emotion/styled';

import {Link} from '@sentry/scraps/link';
import {Markdown, type MarkdownProps} from '@sentry/scraps/markdown';
import {Heading} from '@sentry/scraps/text';

import type {Block} from 'sentry/views/seerExplorer/types';

// ─── Context ────────────────────────────────────────────────

interface BlockContextValue {
  block: Block;
  blockIndex: number;
  getPageReferrer?: () => string;
  interactionPending?: boolean;
  runId?: number;
}

const BlockContext = createContext<BlockContextValue | null>(null);

function useBlockContext(): BlockContextValue {
  const ctx = useContext(BlockContext);
  if (!ctx) {
    throw new Error('useBlockContext must be used within a BlockComponent');
  }
  return ctx;
}

export {BlockContext, useBlockContext};

// ─── Types ──────────────────────────────────────────────────

export type BlockStatus =
  | 'loading'
  | 'content'
  | 'success'
  | 'failure'
  | 'mixed'
  | 'pending';

// ─── Pure Functions ─────────────────────────────────────────

export function getBlockStatus(block: Block): BlockStatus {
  if (block.loading) {
    return 'loading';
  }

  if (!block.message.tool_calls?.length) {
    return 'content';
  }

  const toolLinks = (block.tool_links ?? []).filter(
    (l): l is NonNullable<typeof l> => l !== null
  );

  if (toolLinks.some(l => l.params?.pending_approval || l.params?.pending_question)) {
    return 'pending';
  }

  if (!toolLinks.length) {
    return 'success';
  }

  const failures = toolLinks.filter(
    l => l.params?.is_error === true || l.params?.empty_results === true
  ).length;

  if (failures === 0) return 'success';
  if (failures === toolLinks.length) return 'failure';
  return 'mixed';
}

export function hasValidContent(content: string | null | undefined): content is string {
  if (!content) {
    return false;
  }
  const trimmed = content.trim();
  return trimmed.length > 0 && trimmed !== '.';
}

// ─── Markdown ───────────────────────────────────────────────

const ISSUE_SHORT_ID_PATTERN =
  /\b((?:[A-Z][A-Z0-9_]+|[0-9_]+[A-Z][A-Z0-9_]*)(?:-[A-Z0-9]+)+)\b/;

function IssueIdText({children}: {children: string}) {
  const parts = children.split(ISSUE_SHORT_ID_PATTERN);
  if (parts.length === 1) {
    return children;
  }
  return (
    <Fragment>
      {parts.map((part, i) =>
        i % 2 === 1 ? (
          <Link key={i} to={`/issues/${part}/`}>
            {part}
          </Link>
        ) : (
          part
        )
      )}
    </Fragment>
  );
}

const SEER_MARKDOWN_COMPONENTS: MarkdownProps['components'] = {
  Text: IssueIdText,
  Heading: ({children, level}) => (
    <Heading as={`h${level}`} size="lg">
      {children}
    </Heading>
  ),
};

export function SeerMarkdown(props: Omit<MarkdownProps, 'components'>) {
  return <Markdown {...props} components={SEER_MARKDOWN_COMPONENTS} />;
}

// ─── Styled Components ──────────────────────────────────────

const spin = keyframes`
  to { transform: rotate(360deg); }
`;

export const Spinner = styled('div')`
  box-sizing: border-box;
  width: 12px;
  height: 12px;
  border-radius: 50%;
  border: 1.5px solid ${p => p.theme.tokens.border.primary};
  border-left-color: ${p => p.theme.tokens.border.accent.vibrant};
  animation: ${spin} 0.6s linear infinite;
  flex-shrink: 0;
`;

export const BlockWrapper = styled('div')`
  width: 100%;
  position: relative;
  flex-shrink: 0;
`;
