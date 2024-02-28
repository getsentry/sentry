import {Fragment, useMemo} from 'react';
import {useTheme} from '@emotion/react';

import {Tooltip} from 'sentry/components/tooltip';
import {parseFormula} from 'sentry/views/ddm/formulaParser/parser';
import {TokenType} from 'sentry/views/ddm/formulaParser/types';

import grammar from './formulaFormatting.pegjs';

const operatorTokens = new Set([
  TokenType.PLUS,
  TokenType.MINUS,
  TokenType.MULTIPLY,
  TokenType.DIVIDE,
]);

export function FormularFormatter({
  formula,
  validateVariable,
  enableValidation = false,
}: {
  formula: string;
  enableValidation?: boolean;
  validateVariable?: (variable: string) => string | null;
}) {
  const theme = useTheme();
  const tokens = useMemo(() => {
    try {
      return grammar.parse(formula.trim());
    } catch (err) {
      return [{type: TokenType.GENERIC, content: formula}];
    }
  }, [formula]);

  const error = useMemo(() => {
    if (!enableValidation) {
      return null;
    }
    try {
      parseFormula(formula.trim());
      return null;
    } catch (err) {
      return err;
    }
  }, [formula, enableValidation]);

  const errorIndex = error?.location?.start?.offset ?? null;
  let charCount = 0;
  let hasActiveTooltip = false;

  return (
    <Fragment>
      {tokens.map((token, index) => {
        charCount += token.content.length;
        if (errorIndex !== null && charCount >= errorIndex) {
          const content = (
            <span key={index} style={{color: theme.errorText}}>
              {token.content}
            </span>
          );

          const showTooltip =
            charCount === errorIndex && !hasActiveTooltip && enableValidation;
          hasActiveTooltip = hasActiveTooltip || showTooltip;

          return showTooltip ? (
            <Tooltip title={error.message} key={index} forceVisible>
              {content}
            </Tooltip>
          ) : (
            content
          );
        }

        if (token.type === TokenType.VARIABLE) {
          const variableError = enableValidation && validateVariable?.(token.content);
          const content = (
            <span
              key={index}
              style={{color: !variableError ? theme.yellow400 : theme.errorText}}
            >
              {token.content}
            </span>
          );

          const showTooltip = !!variableError && !hasActiveTooltip && enableValidation;
          hasActiveTooltip = hasActiveTooltip || showTooltip;

          return showTooltip ? (
            <Tooltip title={variableError} key={index} forceVisible>
              {content}
            </Tooltip>
          ) : (
            content
          );
        }

        if (operatorTokens.has(token.type)) {
          return (
            <span key={index} style={{color: theme.blue300}}>
              {token.content}
            </span>
          );
        }

        return (
          <span key={index} style={{color: theme.gray500}}>
            {token.content}
          </span>
        );
      })}{' '}
    </Fragment>
  );
}
