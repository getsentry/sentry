import {Fragment} from 'react';

import {Text} from '@sentry/scraps/text';

import type {SavedFormula} from 'sentry/views/explore/hooks/useGetSavedFormulas';

export const VARIABLE_PATTERN = /\{([^{}]+)\}/g;

type TokenKind = 'parameter' | 'calculation' | 'reference';

/** Every name a formula can interpolate, keyed by the name inside the `{}`. */
type TokenMap = Record<string, TokenKind>;

const TOKEN_VARIANT_MAP = {
  parameter: 'promotion',
  calculation: 'accent',
  reference: 'promotion',
} as const;

export function buildTokenMap({
  params,
  references,
}: Pick<SavedFormula, 'params' | 'references'>): TokenMap {
  const tokens: TokenMap = {};

  for (const param of params) {
    tokens[param.name] = param.type === 'calculation' ? 'calculation' : 'parameter';
  }
  for (const reference of references) {
    tokens[reference.name] = 'reference';
  }

  return tokens;
}

export function FormulaToken({children, kind}: {children: string; kind: TokenKind}) {
  return (
    <Text as="span" variant={TOKEN_VARIANT_MAP[kind]}>
      {children}
    </Text>
  );
}

/**
 * Renders the `{name}` interpolations in an expression as coloured tokens, without
 * the braces that only matter to the API. Names the formula doesn't define are left
 * as they were written so they stand out as broken.
 */
export function FormulaTokens({
  expression,
  tokens,
}: {
  expression: string;
  tokens: TokenMap;
}) {
  const segments: Array<{text: string; kind?: TokenKind}> = [];
  let cursor = 0;

  for (const match of expression.matchAll(VARIABLE_PATTERN)) {
    const kind = tokens[match[1]!];
    if (!kind) {
      continue;
    }

    if (match.index > cursor) {
      segments.push({text: expression.slice(cursor, match.index)});
    }
    segments.push({text: match[1]!, kind});
    cursor = match.index + match[0].length;
  }

  if (cursor < expression.length) {
    segments.push({text: expression.slice(cursor)});
  }

  return (
    <Fragment>
      {segments.map((segment, index) =>
        segment.kind ? (
          <FormulaToken key={index} kind={segment.kind}>
            {segment.text}
          </FormulaToken>
        ) : (
          <Fragment key={index}>{segment.text}</Fragment>
        )
      )}
    </Fragment>
  );
}
