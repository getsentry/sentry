import type {ElementType, ReactNode} from 'react';

import {Checkbox} from '@sentry/scraps/checkbox';
import {Separator} from '@sentry/scraps/separator';

import type {MarkedToken, Token as TokenType} from 'sentry/utils/marked/marked';
import {sanitizeHtml} from 'sentry/utils/marked/marked';
import {unreachable} from 'sentry/utils/unreachable';

import {
  DefaultBlockquote,
  DefaultCodeBlock,
  DefaultHeading,
  DefaultHtmlBlock,
  DefaultInlineCode,
  DefaultLink,
  DefaultParagraph,
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
      return <P>{renderInline(token.tokens, components)}</P>;
    }

    case 'heading': {
      const H = components.Heading ?? DefaultHeading;
      return (
        <H level={token.depth as 1 | 2 | 3 | 4 | 5 | 6}>
          {renderInline(token.tokens, components)}
        </H>
      );
    }

    case 'code': {
      const Code = components.CodeBlock ?? DefaultCodeBlock;
      return <Code lang={token.lang ?? undefined}>{token.text}</Code>;
    }

    case 'codespan': {
      const Code = components.InlineCode ?? DefaultInlineCode;
      return <Code>{token.text}</Code>;
    }

    case 'blockquote': {
      const Blockquote = components.Blockquote ?? DefaultBlockquote;
      return <Blockquote>{renderInline(token.tokens, components)}</Blockquote>;
    }

    case 'list': {
      const List: ElementType = token.ordered
        ? (components.OrderedList ?? 'ol')
        : (components.UnorderedList ?? 'ul');
      return (
        <List>
          {token.items.map((item, i) => (
            <Token key={i} token={item} components={components} />
          ))}
        </List>
      );
    }

    case 'list_item': {
      const Li = components.ListItem ?? 'li';
      const checked = token.task ? token.checked : undefined;
      return <Li checked={checked}>{renderInline(token.tokens, components)}</Li>;
    }

    case 'checkbox':
      return <Checkbox checked={token.checked} disabled />;

    case 'table': {
      const TableComp = components.Table ?? 'table';
      const Thead = components.TableHead ?? 'thead';
      const Tbody = components.TableBody ?? 'tbody';
      const Tr = components.TableRow ?? 'tr';
      const Th = components.TableHeaderCell ?? 'th';
      const Td = components.TableCell ?? 'td';

      return (
        <TableComp>
          <Thead>
            <Tr>
              {token.header.map((cell, i) => (
                <Th key={i} align={token.align[i] ?? undefined}>
                  {renderInline(cell.tokens, components)}
                </Th>
              ))}
            </Tr>
          </Thead>
          <Tbody>
            {token.rows.map((row, rowIndex) => (
              <Tr key={rowIndex}>
                {row.map((cell, cellIndex) => (
                  <Td key={cellIndex} align={token.align[cellIndex] ?? undefined}>
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
      const Hr = components.HorizontalRule ?? Separator;
      return <Hr orientation="horizontal" />;
    }

    case 'html': {
      const Html = components.Html ?? DefaultHtmlBlock;
      return <Html html={token.text} />;
    }

    case 'strong': {
      const Strong = components.Strong ?? 'strong';
      return <Strong>{renderInline(token.tokens, components)}</Strong>;
    }

    case 'em': {
      const Em = components.Emphasis ?? 'em';
      return <Em>{renderInline(token.tokens, components)}</Em>;
    }

    case 'del': {
      const Del = components.Strikethrough ?? 'del';
      return <Del>{renderInline(token.tokens, components)}</Del>;
    }

    case 'link': {
      const A = components.Link ?? DefaultLink;
      return (
        <A href={token.href} title={token.title}>
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
        return <TextComponent>{token.text}</TextComponent>;
      }
      return token.text;
    }

    case 'escape':
      return token.text;

    case 'br': {
      const Br = components.LineBreak ?? 'br';
      return <Br />;
    }

    case 'def':
      return null;

    default:
      unreachable(token);
      return null;
  }
}
