import {Fragment, useEffect, useRef, useState} from 'react';
import {css, keyframes} from '@emotion/react';
import styled from '@emotion/styled';
import {useReducedMotion} from 'framer-motion';

import {Tooltip} from 'sentry/components/tooltip';
import {space} from 'sentry/styles/space';

import type {ParseResult, TokenResult} from './parser';
import {Token} from './parser';
import {isWithinToken} from './utils';

type Props = {
  /**
   * The result from parsing the search query string
   */
  parsedQuery: ParseResult;
  /**
   * The current location of the cursor within the query. This is used to
   * highlight active tokens and trigger error tooltips.
   */
  cursorPosition?: number;
};

/**
 * Renders the parsed query with syntax highlighting.
 */
export default function HighlightQuery({parsedQuery, cursorPosition}: Props) {
  const result = renderResult(parsedQuery, cursorPosition ?? -1);

  return <Fragment>{result}</Fragment>;
}

function renderResult(result: ParseResult, cursor: number) {
  return result
    .map(t => renderToken(t, cursor))
    .map((renderedToken, i) => <Fragment key={i}>{renderedToken}</Fragment>);
}

function renderToken(token: TokenResult<Token>, cursor: number) {
  switch (token.type) {
    case Token.SPACES:
      return token.value;

    case Token.FILTER:
      return <FilterToken filter={token} cursor={cursor} />;

    case Token.VALUE_TEXT_LIST:
    case Token.VALUE_NUMBER_LIST:
      return <ListToken token={token} cursor={cursor} />;

    case Token.VALUE_NUMBER:
      return <NumberToken token={token} />;

    case Token.VALUE_BOOLEAN:
      return <Boolean>{token.text}</Boolean>;

    case Token.VALUE_ISO_8601_DATE:
      return <DateTime>{token.text}</DateTime>;

    case Token.LOGIC_GROUP:
      return <LogicGroup>{renderResult(token.inner, cursor)}</LogicGroup>;

    case Token.LOGIC_BOOLEAN:
      return <LogicalBooleanToken token={token} cursor={cursor} />;

    case Token.FREE_TEXT:
      return <FreeTextToken token={token} cursor={cursor} />;

    case Token.L_PAREN:
    case Token.R_PAREN:
      return <Paren>{token.text}</Paren>;

    default:
      return token.text;
  }
}

// XXX(epurkhiser): We have to animate `left` here instead of `transform` since
// inline elements cannot be transformed. The filter _must_ be inline to
// support text wrapping.
const shakeAnimation = keyframes`
  ${new Array(4)
    .fill(0)
    .map((_, i) => `${i * (100 / 4)}% { left: ${3 * (i % 2 === 0 ? 1 : -1)}px; }`)
    .join('\n')}
`;

function useTokenValidation(
  cursor: number,
  token: TokenResult<Token.FILTER | Token.FREE_TEXT | Token.LOGIC_BOOLEAN>
) {
  const isActive = isWithinToken(token, cursor);

  // This state tracks if the cursor has left the filter token. We initialize it
  // to !isActive in the case where the filter token is rendered without the
  // cursor initially being in it.
  const [hasLeft, setHasLeft] = useState(!isActive);

  // Used to trigger the shake animation when the element becomes invalid
  const tokenElementRef = useRef<HTMLSpanElement>(null);

  // Trigger the effect when isActive changes to updated whether the cursor has
  // left the token.
  useEffect(() => {
    if (!isActive && !hasLeft) {
      setHasLeft(true);
    }
  }, [hasLeft, isActive]);

  const showInvalid = hasLeft && !!token.invalid;
  const showWarning = 'warning' in token && hasLeft && !!token.warning;
  const showTooltip = (showInvalid || showWarning) && isActive;

  const reduceMotion = useReducedMotion();

  // Trigger the shakeAnimation when showInvalid is set to true. We reset the
  // animation by clearing the style, set it to running, and re-applying the
  // animation
  useEffect(() => {
    if (!tokenElementRef.current || !showInvalid || reduceMotion) {
      return;
    }

    const style = tokenElementRef.current.style;

    style.animation = 'none';
    void tokenElementRef.current.offsetTop;

    window.requestAnimationFrame(
      () => (style.animation = `${shakeAnimation.name} 300ms`)
    );
  }, [reduceMotion, showInvalid]);

  return {tokenElementRef, showInvalid, showWarning, showTooltip, isActive};
}

function FilterToken({
  filter,
  cursor,
}: {
  cursor: number;
  filter: TokenResult<Token.FILTER>;
}) {
  const {showInvalid, showTooltip, showWarning, tokenElementRef, isActive} =
    useTokenValidation(cursor, filter);

  return (
    <Tooltip
      disabled={!showTooltip}
      title={filter.invalid?.reason ?? filter.warning}
      overlayStyle={{maxWidth: '350px'}}
      forceVisible
      skipWrapper
    >
      <TokenGroup
        ref={tokenElementRef}
        active={isActive}
        invalid={showInvalid}
        warning={showWarning}
        data-test-id={showInvalid ? 'filter-token-invalid' : 'filter-token'}
      >
        {filter.negated && <Negation>!</Negation>}
        <KeyToken token={filter.key} negated={filter.negated} />
        {filter.operator && <Operator>{filter.operator}</Operator>}
        <Value>{renderToken(filter.value, cursor)}</Value>
      </TokenGroup>
    </Tooltip>
  );
}

function FreeTextToken({
  cursor,
  token,
}: {
  cursor: number;
  token: TokenResult<Token.FREE_TEXT>;
}) {
  const {showInvalid, showTooltip, tokenElementRef, isActive} = useTokenValidation(
    cursor,
    token
  );

  return (
    <Tooltip
      disabled={!showTooltip}
      title={token.invalid?.reason}
      overlayStyle={{maxWidth: '350px'}}
      forceVisible
      skipWrapper
    >
      <FreeTextTokenGroup ref={tokenElementRef} active={isActive} invalid={showInvalid}>
        <FreeText>{token.text}</FreeText>
      </FreeTextTokenGroup>
    </Tooltip>
  );
}

function LogicalBooleanToken({
  cursor,
  token,
}: {
  cursor: number;
  token: TokenResult<Token.LOGIC_BOOLEAN>;
}) {
  const {showInvalid, showTooltip, tokenElementRef} = useTokenValidation(cursor, token);

  return (
    <Tooltip
      disabled={!showTooltip}
      title={token.invalid?.reason}
      overlayStyle={{maxWidth: '350px'}}
      forceVisible
      skipWrapper
    >
      <LogicBoolean ref={tokenElementRef} invalid={showInvalid}>
        {token.text}
      </LogicBoolean>
    </Tooltip>
  );
}

function KeyToken({
  token,
  negated,
}: {
  token: TokenResult<
    | Token.KEY_SIMPLE
    | Token.KEY_AGGREGATE
    | Token.KEY_EXPLICIT_TAG
    | Token.KEY_EXPLICIT_NUMBER_TAG
    | Token.KEY_EXPLICIT_STRING_TAG
  >;
  negated?: boolean;
}) {
  let value: React.ReactNode = token.text;

  if (token.type === Token.KEY_EXPLICIT_TAG) {
    value = (
      <ExplicitKey prefix={token.prefix}>
        {token.key.quoted ? `"${token.key.value}"` : token.key.value}
      </ExplicitKey>
    );
  }

  return <Key negated={!!negated}>{value}:</Key>;
}

function ListToken({
  token,
  cursor,
}: {
  cursor: number;
  token: TokenResult<Token.VALUE_NUMBER_LIST | Token.VALUE_TEXT_LIST>;
}) {
  return (
    <InList>
      {token.items.map(({value, separator}) => [
        <ListComma key="comma">{separator}</ListComma>,
        value && renderToken(value, cursor),
      ])}
    </InList>
  );
}

function NumberToken({token}: {token: TokenResult<Token.VALUE_NUMBER>}) {
  return (
    <Fragment>
      {token.value}
      <Unit>{token.unit}</Unit>
    </Fragment>
  );
}

type TokenGroupProps = {
  active: boolean;
  invalid: boolean;
  warning?: boolean;
};

const colorType = (p: TokenGroupProps) =>
  `${p.invalid ? 'invalid' : p.warning ? 'warning' : 'valid'}${
    p.active ? 'Active' : ''
  }` as const;

const TokenGroup = styled('span')<TokenGroupProps>`
  --token-bg: ${p => p.theme.searchTokenBackground[colorType(p)]};
  --token-border: ${p => p.theme.searchTokenBorder[colorType(p)]};
  --token-value-color: ${p =>
    p.invalid ? p.theme.red400 : p.warning ? p.theme.gray400 : p.theme.blue400};

  position: relative;
  animation-name: ${shakeAnimation};
`;

const FreeTextTokenGroup = styled(TokenGroup)`
  ${p =>
    !p.invalid &&
    css`
      --token-bg: inherit;
      --token-border: inherit;
      --token-value-color: inherit;
    `}
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
  margin-left: -1px;
  font-weight: ${p => p.theme.fontWeightBold};
  border-radius: 2px 0 0 2px;
  color: ${p => p.theme.red400};
`;

const Key = styled('span')<{negated: boolean}>`
  ${filterCss};
  border-right: none;
  font-weight: ${p => p.theme.fontWeightBold};
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
  color: ${p => p.theme.pink400};
`;

const Value = styled('span')`
  ${filterCss};
  border-left: none;
  border-radius: 0 2px 2px 0;
  color: var(--token-value-color);
  margin: -1px -2px -1px 0;
  padding-right: 1px;
`;

const FreeText = styled('span')`
  ${filterCss};
  border-radius: 2px;
  color: var(--token-value-color);
  margin: -1px -2px -1px 0;
  padding-right: 1px;
  padding-left: 1px;
`;

const Unit = styled('span')`
  font-weight: ${p => p.theme.fontWeightBold};
  color: ${p => p.theme.green400};
`;

const LogicBoolean = styled('span')<{invalid: boolean}>`
  font-weight: ${p => p.theme.fontWeightBold};
  color: ${p => p.theme.gray300};
  ${p => p.invalid && `color: ${p.theme.red400}`}
`;

const Boolean = styled('span')`
  color: ${p => p.theme.pink400};
`;

const DateTime = styled('span')`
  color: ${p => p.theme.green400};
`;

const ListComma = styled('span')`
  color: ${p => p.theme.gray300};
`;

const Paren = styled('span')`
  color: ${p => p.theme.gray300};
`;

const InList = styled('span')`
  &:before {
    content: '[';
    font-weight: ${p => p.theme.fontWeightBold};
    color: ${p => p.theme.purple400};
  }
  &:after {
    content: ']';
    font-weight: ${p => p.theme.fontWeightBold};
    color: ${p => p.theme.purple400};
  }

  ${Value} {
    color: ${p => p.theme.purple400};
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
      color: ${p => p.theme.pink400};
      font-size: 16px;
      font-weight: ${p => p.theme.fontWeightBold};
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
