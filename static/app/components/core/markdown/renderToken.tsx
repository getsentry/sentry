import type {ReactNode} from 'react';

import type {Token, Tokens} from 'sentry/utils/marked/marked';
import {sanitizeHtml} from 'sentry/utils/marked/marked';

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

function hasInlineHtml(tokens: Token[]): boolean {
  return tokens.some(t => t.type === 'html');
}

function renderInline(
  tokens: Token[] | undefined,
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
  return tokens.map((token, i) => renderToken(token, components, i));
}

export function renderToken(
  token: Token,
  components: MarkdownComponents,
  key: number
): ReactNode {
  switch (token.type) {
    case 'space':
      return null;

    case 'paragraph': {
      const P = components.Paragraph ?? DefaultParagraph;
      return <P key={key}>{renderInline(token.tokens, components)}</P>;
    }

    case 'heading': {
      const headingToken = token as Tokens.Heading;
      const H = components.Heading ?? DefaultHeading;
      return (
        <H key={key} level={headingToken.depth as 1 | 2 | 3 | 4 | 5 | 6}>
          {renderInline(headingToken.tokens, components)}
        </H>
      );
    }

    case 'code': {
      const codeToken = token as Tokens.Code;
      const Code = components.CodeBlock ?? DefaultCodeBlock;
      return (
        <Code key={key} lang={codeToken.lang ?? undefined}>
          {codeToken.text}
        </Code>
      );
    }

    case 'codespan': {
      const codespanToken = token as Tokens.Codespan;
      const Code = components.InlineCode ?? DefaultInlineCode;
      return <Code key={key}>{codespanToken.text}</Code>;
    }

    case 'blockquote': {
      const Blockquote = components.Blockquote ?? DefaultBlockquote;
      return <Blockquote key={key}>{renderInline(token.tokens, components)}</Blockquote>;
    }

    case 'list': {
      const listToken = token as Tokens.List;
      if (listToken.ordered) {
        const Ol = components.OrderedList ?? 'ol';
        return (
          <Ol key={key}>
            {listToken.items.map((item, i) => renderListItem(item, components, i))}
          </Ol>
        );
      }
      const Ul = components.UnorderedList ?? 'ul';
      return (
        <Ul key={key}>
          {listToken.items.map((item, i) => renderListItem(item, components, i))}
        </Ul>
      );
    }

    case 'table': {
      const tableToken = token as Tokens.Table;
      const TableComp = components.Table ?? 'table';
      const Thead = components.TableHead ?? 'thead';
      const Tbody = components.TableBody ?? 'tbody';
      const Tr = components.TableRow ?? 'tr';
      const Th = components.TableHeaderCell ?? 'th';
      const Td = components.TableCell ?? 'td';

      return (
        <TableComp key={key}>
          <Thead>
            <Tr>
              {tableToken.header.map((cell, i) => (
                <Th key={i} align={tableToken.align[i] ?? undefined}>
                  {renderInline(cell.tokens, components)}
                </Th>
              ))}
            </Tr>
          </Thead>
          <Tbody>
            {tableToken.rows.map((row, rowIndex) => (
              <Tr key={rowIndex}>
                {row.map((cell, cellIndex) => (
                  <Td key={cellIndex} align={tableToken.align[cellIndex] ?? undefined}>
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
      const Hr = components.HorizontalRule ?? 'hr';
      return <Hr key={key} />;
    }

    case 'html': {
      const htmlToken = token as Tokens.HTML;
      const Html = components.Html ?? DefaultHtmlBlock;
      return <Html key={key} html={htmlToken.text} />;
    }

    case 'strong': {
      const Strong = components.Strong ?? 'strong';
      return <Strong key={key}>{renderInline(token.tokens, components)}</Strong>;
    }

    case 'em': {
      const Em = components.Emphasis ?? 'em';
      return <Em key={key}>{renderInline(token.tokens, components)}</Em>;
    }

    case 'del': {
      const Del = components.Strikethrough ?? 'del';
      return <Del key={key}>{renderInline(token.tokens, components)}</Del>;
    }

    case 'link': {
      const linkToken = token as Tokens.Link;
      const A = components.Link ?? DefaultLink;
      return (
        <A key={key} href={linkToken.href} title={linkToken.title}>
          {renderInline(linkToken.tokens, components)}
        </A>
      );
    }

    case 'image': {
      const imageToken = token as Tokens.Image;
      const Img = components.Image;
      if (!Img) {
        return null;
      }
      return (
        <Img
          key={key}
          src={imageToken.href}
          alt={imageToken.text}
          title={imageToken.title}
        />
      );
    }

    case 'text': {
      const textToken = token as Tokens.Text;
      if (textToken.tokens) {
        return renderInline(textToken.tokens, components);
      }
      const TextComponent = components.Text;
      if (TextComponent) {
        return <TextComponent key={key}>{textToken.text}</TextComponent>;
      }
      return textToken.text;
    }

    case 'escape': {
      const escapeToken = token as Tokens.Escape;
      return escapeToken.text;
    }

    case 'br': {
      const Br = components.LineBreak ?? 'br';
      return <Br key={key} />;
    }

    default:
      return null;
  }
}

function renderListItem(
  item: Tokens.ListItem,
  components: MarkdownComponents,
  key: number
): ReactNode {
  const Li = components.ListItem ?? 'li';
  const checked = item.task ? item.checked : undefined;

  return (
    <Li key={key} checked={checked}>
      {renderInline(item.tokens, components)}
    </Li>
  );
}
