import {Fragment} from 'react';
import {css} from '@emotion/react';
import styled from '@emotion/styled';

import space from 'app/styles/space';

import {ParseResult, Token, TokenResult} from './parser';

function renderToken(token: TokenResult<Token>) {
  switch (token.type) {
    case Token.Spaces:
      return token.value;

    case Token.Filter:
      return <FilterToken filter={token} />;

    case Token.ValueTextList:
    case Token.ValueNumberList:
      return <ListToken token={token} />;

    case Token.ValueNumber:
      return <NumberToken token={token} />;

    case Token.ValueBoolean:
      return <Boolean>{token.text}</Boolean>;

    case Token.ValueIso8601Date:
      return <DateTime>{token.text}</DateTime>;

    case Token.LogicGroup:
      return <LogicGroup>{renderResult(token.inner)}</LogicGroup>;

    case Token.LogicBoolean:
      return <LogicBoolean>{token.value}</LogicBoolean>;

    default:
      return token.text;
  }
}

function renderResult(result: ParseResult) {
  return result
    .map(renderToken)
    .map((renderedToken, i) => <Fragment key={i}>{renderedToken}</Fragment>);
}

type Props = {
  /**
   * The result from parsing the search query string
   */
  parsedQuery: ParseResult;
  /**
   * The current location of the cursror within the query. This is used to
   * highligh active tokens and trigger error tooltips.
   */
  cursorPosition?: number;
};

/**
 * Renders the parsed query with syntax highlighting.
 */
export default function HighlightQuery({parsedQuery}: Props) {
  const rendered = renderResult(parsedQuery);

  return <Fragment>{rendered}</Fragment>;
}

const FilterToken = ({filter}: {filter: TokenResult<Token.Filter>}) => (
  <Filter>
    {filter.negated && <Negation>!</Negation>}
    <KeyToken token={filter.key} negated={filter.negated} />
    {filter.operator && <Operator>{filter.operator}</Operator>}
    <Value>{renderToken(filter.value)}</Value>
  </Filter>
);

const KeyToken = ({
  token,
  negated,
}: {
  token: TokenResult<Token.KeySimple | Token.KeyAggregate | Token.KeyExplicitTag>;
  negated?: boolean;
}) => {
  let value: React.ReactNode = token.text;

  if (token.type === Token.KeyExplicitTag) {
    value = (
      <ExplicitKey prefix={token.prefix}>
        {token.key.quoted ? `"${token.key.value}"` : token.key.value}
      </ExplicitKey>
    );
  }

  return <Key negated={!!negated}>{value}:</Key>;
};

const ListToken = ({
  token,
}: {
  token: TokenResult<Token.ValueNumberList | Token.ValueTextList>;
}) => (
  <InList>
    {token.items.map(({value, separator}) => [
      <ListComma key="comma">{separator}</ListComma>,
      renderToken(value),
    ])}
  </InList>
);

const NumberToken = ({token}: {token: TokenResult<Token.ValueNumber>}) => (
  <Fragment>
    {token.value}
    <Unit>{token.unit}</Unit>
  </Fragment>
);

const Filter = styled('span')`
  --token-bg: ${p => p.theme.searchTokenBackground};
  --token-border: ${p => p.theme.searchTokenBorder};
  --token-value-color: ${p => p.theme.blue300};
`;

const filterCss = css`
  background: var(--token-bg);
  border: 0.5px solid var(--token-border);
  padding: ${space(0.25)} 0;
`;

const Negation = styled('span')`
  ${filterCss};
  border-right: none;
  padding-left: 1px;
  margin-left: -2px;
  font-weight: bold;
  border-radius: 2px 0 0 2px;
  color: ${p => p.theme.red300};
`;

const Key = styled('span')<{negated: boolean}>`
  ${filterCss};
  border-right: none;
  font-weight: bold;
  ${p =>
    !p.negated
      ? css`
          border-radius: 2px 0 0 2px;
          padding-left: 1px;
          margin-left: -2px;
        `
      : css`
          border-left: none;
          margin-left: 0;
        `};
`;

const ExplicitKey = styled('span')<{prefix: string}>`
  &:before,
  &:after {
    color: ${p => p.theme.subText};
  }
  &:before {
    content: '${p => p.prefix}[';
  }
  &:after {
    content: ']';
  }
`;

const Operator = styled('span')`
  ${filterCss};
  border-left: none;
  border-right: none;
  margin: -1px 0;
  color: ${p => p.theme.orange400};
`;

const Value = styled('span')`
  ${filterCss};
  border-left: none;
  border-radius: 0 2px 2px 0;
  color: var(--token-value-color);
  margin: -1px -2px -1px 0;
  padding-right: 1px;
`;

const Unit = styled('span')`
  font-weight: bold;
  color: ${p => p.theme.green300};
`;

const LogicBoolean = styled('span')`
  font-weight: bold;
  color: ${p => p.theme.red300};
`;

const Boolean = styled('span')`
  color: ${p => p.theme.pink300};
`;

const DateTime = styled('span')`
  color: ${p => p.theme.green300};
`;

const ListComma = styled('span')`
  color: ${p => p.theme.gray300};
`;

const InList = styled('span')`
  &:before {
    content: '[';
    font-weight: bold;
    color: ${p => p.theme.purple300};
  }
  &:after {
    content: ']';
    font-weight: bold;
    color: ${p => p.theme.purple300};
  }

  ${Value} {
    color: ${p => p.theme.purple300};
  }
`;

const LogicGroup = styled(({children, ...props}) => (
  <span {...props}>
    <span>(</span>
    {children}
    <span>)</span>
  </span>
))`
  > span:first-child,
  > span:last-child {
    position: relative;
    color: transparent;

    &:before {
      position: absolute;
      top: -5px;
      color: ${p => p.theme.orange400};
      font-size: 16px;
      font-weight: bold;
    }
  }

  > span:first-child:before {
    left: -3px;
    content: '(';
  }
  > span:last-child:before {
    right: -3px;
    content: ')';
  }
`;
