import {Fragment, useMemo} from 'react';
import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';

import {TokenType} from 'sentry/components/metrics/equationInput/syntax/types';
import {Tooltip} from 'sentry/components/tooltip';

import grammar from './equationFormatting.pegjs';

const operatorTokens = new Set([
  TokenType.PLUS,
  TokenType.MINUS,
  TokenType.MULTIPLY,
  TokenType.DIVIDE,
]);

interface EquationFormatterProps {
  equation: string;
  errors?: {
    message: string;
    start: number;
    end?: number;
  }[];
}

export function EquationFormatter({equation: formula, errors}: EquationFormatterProps) {
  const theme = useTheme();
  const tokens = useMemo(() => {
    try {
      return grammar.parse(formula);
    } catch (err) {
      return undefined;
    }
  }, [formula]);

  if (!tokens) {
    // If the formula cannot be parsed, we simply return it without any highlighting
    return <Fragment>{formula}</Fragment>;
  }

  const findMatchingError = (charCount: number) => {
    if (!errors || errors.length === 0) {
      return null;
    }
    return errors.find(
      error => error.start <= charCount && (!error.end || error.end >= charCount)
    );
  };

  let charCount = 0;
  let hasActiveTooltip = false;

  const renderedTokens = (
    <Fragment>
      {tokens.map((token: any, index: any) => {
        const error = findMatchingError(charCount);
        charCount += token.content.length;

        if (error) {
          const content = (
            <Token key={index} style={{color: theme.errorText}}>
              {token.content}
            </Token>
          );

          // Only show one tooltip at a time
          const showTooltip = !hasActiveTooltip;
          hasActiveTooltip = true;

          return showTooltip ? (
            <Tooltip title={error.message} key={index} forceVisible>
              {content}
            </Tooltip>
          ) : (
            content
          );
        }

        if (token.type === TokenType.VARIABLE) {
          return (
            <Token key={index} style={{color: theme.yellow400, fontWeight: 'bold'}}>
              {token.content}
            </Token>
          );
        }

        if (operatorTokens.has(token.type)) {
          return (
            <Token key={index} style={{color: theme.blue300}}>
              {token.content}
            </Token>
          );
        }

        return (
          <Token key={index} style={{color: theme.gray500}}>
            {token.content}
          </Token>
        );
      })}
    </Fragment>
  );

  // Unexpected EOL might not match a token
  const remainingError = !hasActiveTooltip && findMatchingError(charCount);
  return (
    <Fragment>
      {renderedTokens}
      {remainingError && (
        <Tooltip title={findMatchingError(charCount)?.message} forceVisible>
          &nbsp;
        </Tooltip>
      )}
    </Fragment>
  );
}

const Token = styled('span')`
  white-space: pre;
`;
