import {Fragment} from 'react';
import {css} from '@emotion/react';
import styled from '@emotion/styled';

import {ParseResult, parseSearch, Token, TokenResult} from './parser';

class ResultRenderer {
  renderFilter = (filter: TokenResult<Token.Filter>) => (
    <FilterToken>
      {filter.negated && <Negation>!</Negation>}
      <Key negated={filter.negated}>{filter.key.text}:</Key>
      {filter.operator && <Operator>{filter.operator}</Operator>}
      <Value>{this.renderToken(filter.value)}</Value>
    </FilterToken>
  );

  renderList = (token: TokenResult<Token.ValueNumberList | Token.ValueTextList>) => (
    <InList>
      {token.items.map(({value, separator}) => [
        <ListComma key="comma">{separator}</ListComma>,
        this.renderToken(value),
      ])}
    </InList>
  );

  renderNumber = (token: TokenResult<Token.ValueNumber>) => (
    <Number>
      {token.value}
      <Unit>{token.unit}</Unit>
    </Number>
  );

  renderToken = (token: TokenResult<Token>) => {
    switch (token.type) {
      case Token.Spaces:
        return token.value;

      case Token.Filter:
        return this.renderFilter(token);

      case Token.LogicGroup:
        return <LogicGroup>{this.renderResult(token.inner)}</LogicGroup>;

      case Token.LogicBoolean:
        return <LogicBoolean>{token.value}</LogicBoolean>;

      case Token.ValueIso8601Date:
        return <DateTime>{token.text}</DateTime>;

      case Token.ValueTextList:
      case Token.ValueNumberList:
        return this.renderList(token);

      case Token.ValueNumber:
        return this.renderNumber(token);

      default:
        return token.text;
    }
  };

  renderResult = (result: ParseResult) =>
    result
      .map(this.renderToken)
      .map((renderedToken, i) => <Fragment key={i}>{renderedToken}</Fragment>);
}

export default function renderQuery(query: string) {
  try {
    const parseResult = parseSearch(query);

    console.log(parseResult);

    return new ResultRenderer().renderResult(parseSearch(query));
  } catch (err) {
    // eslint-disable-next-line no-console
    console.log(err);
    return query;
  }
}

const FilterToken = styled('span')``;

const tokenCss = css`
  background: rgba(181, 218, 255, 0.3);
  border: 0.5px solid #b5daff;
  padding: 1px 0;
`;

const Negation = styled('span')`
  ${tokenCss};
  border-right: none;
  padding-left: 2px;
  margin-left: -3px;
  font-weight: bold;
  border-radius: 2px 0 0 2px;
  color: ${p => p.theme.red300};
`;

const Key = styled('span')<{negated: boolean}>`
  ${tokenCss};
  border-right: none;
  font-weight: bold;
  ${p =>
    !p.negated
      ? css`
          border-radius: 2px 0 0 2px;
          padding-left: 2px;
          margin-left: -3px;
        `
      : css`
          border-left: none;
          margin-left: 0;
        `};
`;

const Operator = styled('span')`
  ${tokenCss};
  border-left: none;
  border-right: none;
  margin: -1px 0;
  color: ${p => p.theme.orange400};
`;

const Value = styled('span')`
  ${tokenCss};
  border-left: none;
  border-radius: 0 2px 2px 0;
  color: #2763d4;
  margin: -1px -3px -1px 0;
  padding-right: 2px;
`;

const Number = styled('span')`
  color: ${p => p.theme.red300};
`;

const Unit = styled('span')`
  font-weight: bold;
  color: ${p => p.theme.orange400};
`;

const LogicBoolean = styled('span')`
  font-weight: bold;
  color: ${p => p.theme.red300};
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
`;

const LogicGroup = styled('span')`
  &:before {
    position: relative;
    left: -2px;
    font-weight: bold;
    content: '(';
    color: ${p => p.theme.green300};
  }
  &:after {
    position: relative;
    right: -2px;
    font-weight: bold;
    content: ')';
    color: ${p => p.theme.green300};
  }
`;
