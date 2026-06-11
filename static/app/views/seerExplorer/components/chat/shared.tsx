import type {ReactNode} from 'react';
import {createContext, Fragment, useContext} from 'react';
import {keyframes} from '@emotion/react';
import styled from '@emotion/styled';

import {Flex} from '@sentry/scraps/layout';
import {Link} from '@sentry/scraps/link';
import {Markdown, type MarkdownProps} from '@sentry/scraps/markdown';
import {Heading} from '@sentry/scraps/text';

import type {Block} from 'sentry/views/seerExplorer/types';

interface BlockVariantProps {
  block: Block;
}

export interface UserBlockProps extends BlockVariantProps {}

export interface AssistantBlockProps extends BlockVariantProps {
  blockIndex: number;
  interactionPending?: boolean;
  readOnly?: boolean;
  runId?: number;
}

export interface ToolUseBlockProps extends BlockVariantProps {
  blocks?: Block[];
  getPageReferrer?: () => string;
  showThinking?: boolean;
}

export type BlockStatus =
  | 'loading'
  | 'content'
  | 'success'
  | 'failure'
  | 'mixed'
  | 'pending';

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

  if (failures === 0) {
    return 'success';
  }
  if (failures === toolLinks.length) {
    return 'failure';
  }
  return 'mixed';
}

export function hasValidContent(content: string | null | undefined): content is string {
  if (!content) {
    return false;
  }
  const trimmed = content.trim();
  return trimmed.length > 0 && trimmed !== '.';
}

const ISSUE_SHORT_ID_PATTERN =
  /\b((?:[A-Z][A-Z0-9_]+|[0-9_]+[A-Z][A-Z0-9_]*)(?:-[A-Z0-9]+)+)\b/;

function LinkifyIssueShortIds({children}: {children: string}): ReactNode {
  const parts = children.split(ISSUE_SHORT_ID_PATTERN);
  if (parts.length === 1) {
    return children;
  }
  return (
    <Fragment>
      {parts.map((part, i) => {
        if (!part) {
          return null;
        }
        if (i % 2 === 1) {
          return (
            <Link key={i} to={`/issues/${part}/`}>
              {part}
            </Link>
          );
        }
        return <Fragment key={i}>{part}</Fragment>;
      })}
    </Fragment>
  );
}

const IsInsideLinkContext = createContext(false);

function toRelativeHref(href: string): string {
  if (!/^https?:\/\//.test(href)) {
    return href;
  }
  try {
    const url = new URL(href);
    if (url.origin === window.location.origin) {
      return url.pathname + url.search + url.hash;
    }
  } catch {
    // Invalid URL, use as-is
  }
  return href;
}

const SEER_MARKDOWN_COMPONENTS: MarkdownProps['components'] = {
  Link: ({children, Default, href, title}) => (
    <IsInsideLinkContext.Provider value>
      <Default href={toRelativeHref(href)} title={title}>
        {children}
      </Default>
    </IsInsideLinkContext.Provider>
  ),
  Text: function SeerText({children}) {
    const isInsideLink = useContext(IsInsideLinkContext);
    if (isInsideLink) {
      return children;
    }
    return <LinkifyIssueShortIds>{children}</LinkifyIssueShortIds>;
  },
  InlineCode: function SeerInlineCode({children, Default}) {
    const isInsideLink = useContext(IsInsideLinkContext);
    if (isInsideLink) {
      return <Default>{children}</Default>;
    }
    const parts = children.split(ISSUE_SHORT_ID_PATTERN);
    if (parts.length === 3 && parts[1]) {
      return (
        <Link to={`/issues/${parts[1]}/`}>
          <Default>{children}</Default>
        </Link>
      );
    }
    return <Default>{children}</Default>;
  },
  Heading: ({children, level}) => (
    <Heading as={`h${level}`} size="lg">
      {children}
    </Heading>
  ),
};

export function SeerMarkdown(props: Omit<MarkdownProps, 'components'>) {
  return <Markdown {...props} components={SEER_MARKDOWN_COMPONENTS} />;
}

export function MessagePlaceholder({content}: {content?: string}) {
  return (
    <Flex align="center" gap="md" padding="xl" width="100%">
      <Flex
        display="inline-flex"
        align="center"
        justify="center"
        width="12px"
        height="12px"
        flexShrink={0}
      >
        <Spinner />
      </Flex>
      {hasValidContent(content) && <SeerMarkdown raw={content} />}
    </Flex>
  );
}

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

export const BLOCK_WRAPPER_SELECTOR = '[data-block-wrapper]';
