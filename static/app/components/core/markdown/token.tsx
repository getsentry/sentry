import type {ComponentType, ReactNode} from 'react';

import {Checkbox} from '@sentry/scraps/checkbox';

import type {MarkedToken, Token as TokenType} from 'sentry/utils/marked/marked';
import {isSafeHref, isInternalHref, sanitizeHtml} from 'sentry/utils/marked/marked';
import {unreachable} from 'sentry/utils/unreachable';

import {
  DefaultBlockquote,
  DefaultCodeBlock,
  DefaultEmphasis,
  DefaultHeading,
  DefaultHorizontalRule,
  DefaultHtmlBlock,
  DefaultInlineCode,
  DefaultLineBreak,
  DefaultLink,
  DefaultListItem,
  DefaultOrderedList,
  DefaultParagraph,
  DefaultStrikethrough,
  DefaultStrong,
  DefaultTable,
  DefaultTableBody,
  DefaultTableCell,
  DefaultTableHead,
  DefaultTableHeaderCell,
  DefaultTableRow,
  DefaultTaskList,
  DefaultTaskListItem,
  DefaultText,
  DefaultUnorderedList,
} from './defaultComponents';
import type {MarkdownComponents} from './markdown';

function hasInlineHtml(tokens: TokenType[]): boolean {
  return tokens.some(t => t.type === 'html');
}

function renderInline(
  tokens: TokenType[] | undefined,
  components: MarkdownComponents
): ReactNode {
  if (!tokens) {
    return null;
  }
  // When inline HTML tags are present (e.g. <sub>, <sup>), they get split
  // into separate tokens that can't render in isolation. Fall back to
  // concatenating raw text and rendering as sanitized HTML.
  if (hasInlineHtml(tokens)) {
    const raw = tokens.map(t => t.raw).join('');
    const sanitized = sanitizeHtml(raw);
    return <span dangerouslySetInnerHTML={{__html: sanitized}} />;
  }
  return tokens.map((token, i) => (
    <Token token={token as MarkedToken} key={i} components={components} />
  ));
}

export function Token({
  components,
  token,
}: {
  components: MarkdownComponents;
  token: MarkedToken;
}): ReactNode {
  switch (token.type) {
    case 'space':
      // Blank-line tokens — layout gap is handled by the parent flex container
      return null;

    case 'paragraph': {
      const P = components.Paragraph ?? DefaultParagraph;
      return <P Default={DefaultParagraph}>{renderInline(token.tokens, components)}</P>;
    }

    case 'heading': {
      const H = components.Heading ?? DefaultHeading;
      return (
        <H Default={DefaultHeading} level={token.depth as 1 | 2 | 3 | 4 | 5 | 6}>
          {renderInline(token.tokens, components)}
        </H>
      );
    }

    case 'code': {
      const Code = components.CodeBlock ?? DefaultCodeBlock;
      return (
        <Code Default={DefaultCodeBlock} lang={token.lang ?? undefined}>
          {token.text}
        </Code>
      );
    }

    case 'codespan': {
      const Code = components.InlineCode ?? DefaultInlineCode;
      return <Code Default={DefaultInlineCode}>{token.text}</Code>;
    }

    case 'blockquote': {
      const Blockquote = components.Blockquote ?? DefaultBlockquote;
      return (
        <Blockquote Default={DefaultBlockquote}>
          {renderInline(token.tokens, components)}
        </Blockquote>
      );
    }

    case 'list': {
      const isTaskList = token.items.some(item => item.task);
      if (isTaskList) {
        const List = components.TaskList ?? DefaultTaskList;
        return (
          <List Default={DefaultTaskList}>
            {token.items.map((item, i) => (
              <Token key={i} token={item} components={components} />
            ))}
          </List>
        );
      }
      if (token.ordered) {
        const List = components.OrderedList ?? DefaultOrderedList;
        return (
          <List Default={DefaultOrderedList}>
            {token.items.map((item, i) => (
              <Token key={i} token={item} components={components} />
            ))}
          </List>
        );
      }
      const List = components.UnorderedList ?? DefaultUnorderedList;
      return (
        <List Default={DefaultUnorderedList}>
          {token.items.map((item, i) => (
            <Token key={i} token={item} components={components} />
          ))}
        </List>
      );
    }

    case 'list_item': {
      if (token.task) {
        const TaskLi = components.TaskListItem ?? DefaultTaskListItem;
        return (
          <TaskLi Default={DefaultTaskListItem} checked={token.checked ?? false}>
            {renderInline(token.tokens, components)}
          </TaskLi>
        );
      }
      const Li = components.ListItem ?? DefaultListItem;
      return <Li Default={DefaultListItem}>{renderInline(token.tokens, components)}</Li>;
    }

    case 'checkbox':
      return <Checkbox checked={token.checked} readOnly />;

    case 'table': {
      const TableComp = components.Table ?? DefaultTable;
      const Thead = components.TableHead ?? DefaultTableHead;
      const Tbody = components.TableBody ?? DefaultTableBody;
      const Tr = components.TableRow ?? DefaultTableRow;
      const Th = components.TableHeaderCell ?? DefaultTableHeaderCell;
      const Td = components.TableCell ?? DefaultTableCell;

      return (
        <TableComp Default={DefaultTable}>
          <Thead Default={DefaultTableHead}>
            <Tr Default={DefaultTableRow}>
              {token.header.map((cell, i) => (
                <Th
                  key={i}
                  Default={
                    DefaultTableHeaderCell as ComponentType<{
                      children: ReactNode;
                      align?: string | null;
                    }>
                  }
                  align={token.align[i] ?? undefined}
                >
                  {renderInline(cell.tokens, components)}
                </Th>
              ))}
            </Tr>
          </Thead>
          <Tbody Default={DefaultTableBody}>
            {token.rows.map((row, rowIndex) => (
              <Tr key={rowIndex} Default={DefaultTableRow}>
                {row.map((cell, cellIndex) => (
                  <Td
                    key={cellIndex}
                    Default={
                      DefaultTableCell as ComponentType<{
                        children: ReactNode;
                        align?: string | null;
                      }>
                    }
                    align={token.align[cellIndex] ?? undefined}
                  >
                    {renderInline(cell.tokens, components)}
                  </Td>
                ))}
              </Tr>
            ))}
          </Tbody>
        </TableComp>
      );
    }

    case 'hr': {
      const Hr = components.HorizontalRule ?? DefaultHorizontalRule;
      return <Hr Default={DefaultHorizontalRule} />;
    }

    case 'html': {
      const Html = components.Html ?? DefaultHtmlBlock;
      return <Html Default={DefaultHtmlBlock} html={sanitizeHtml(token.text)} />;
    }

    case 'strong': {
      const Strong = components.Strong ?? DefaultStrong;
      return (
        <Strong Default={DefaultStrong}>{renderInline(token.tokens, components)}</Strong>
      );
    }

    case 'em': {
      const Em = components.Emphasis ?? DefaultEmphasis;
      return <Em Default={DefaultEmphasis}>{renderInline(token.tokens, components)}</Em>;
    }

    case 'del': {
      const Del = components.Strikethrough ?? DefaultStrikethrough;
      return (
        <Del Default={DefaultStrikethrough}>{renderInline(token.tokens, components)}</Del>
      );
    }

    case 'link': {
      if (!isSafeHref(token.href) && !isInternalHref(token.href)) {
        return <span>{renderInline(token.tokens, components)}</span>;
      }
      const A = components.Link ?? DefaultLink;
      return (
        <A Default={DefaultLink} href={token.href} title={token.title}>
          {renderInline(token.tokens, components)}
        </A>
      );
    }

    case 'image': {
      const Img = components.Image;
      if (!Img) {
        // No default <img> to avoid uncontrolled network requests
        return null;
      }
      // marked stores the image URL in `href`
      return <Img src={token.href} alt={token.text} title={token.title} />;
    }

    case 'text': {
      if (token.tokens) {
        return renderInline(token.tokens, components);
      }
      const TextComponent = components.Text;
      if (TextComponent) {
        return <TextComponent Default={DefaultText}>{token.text}</TextComponent>;
      }
      return token.text;
    }

    case 'escape':
      return token.text;

    case 'br': {
      const Br = components.LineBreak ?? DefaultLineBreak;
      return <Br Default={DefaultLineBreak} />;
    }

    case 'def':
      return null;

    default:
      unreachable(token);
      return null;
  }
}
