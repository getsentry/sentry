import {useCallback, useMemo, useState} from 'react';
import styled from '@emotion/styled';
import debounce from 'lodash/debounce';

import Input from 'sentry/components/input';
import {Tooltip} from 'sentry/components/tooltip';
import {t} from 'sentry/locale';
import {joinTokens, parseFormula} from 'sentry/views/ddm/formulaParser/parser';
import {type TokenList, TokenType} from 'sentry/views/ddm/formulaParser/types';

interface Props extends Omit<React.ComponentProps<typeof Input>, 'onChange' | 'value'> {
  availableVariables: Set<string>;
  formulaVariables: Set<string>;
  onChange: (formula: string) => void;
  value: string;
}

function escapeVariables(tokens: TokenList): TokenList {
  return tokens.map(token => {
    if (token.type !== TokenType.VARIABLE) {
      return token;
    }
    return {
      ...token,
      content: `$${token.content}`,
    };
  });
}

function unescapeVariables(formula: string): string {
  return formula.replaceAll('$', '');
}

export function FormulaInput({
  availableVariables,
  formulaVariables,
  value,
  onChange,
  ...props
}: Props) {
  const [error, setError] = useState<string | null>(null);

  const defaultValue = useMemo(() => unescapeVariables(value), [value]);

  const validateVariabled = useCallback(
    (tokens: TokenList): string | null => {
      for (const token of tokens) {
        if (token.type !== TokenType.VARIABLE) {
          continue;
        }
        if (formulaVariables.has(token.content)) {
          return t('Formulas cannot reference other formulas.', token.content);
        }
        if (!availableVariables.has(token.content)) {
          return t('Unknown variable "%s"', token.content);
        }
      }

      return null;
    },
    [availableVariables, formulaVariables]
  );

  const handleChange = useMemo(
    () =>
      debounce((e: React.ChangeEvent<HTMLInputElement>) => {
        const newValue = e.target.value.trim();

        let tokens: TokenList = [];
        if (newValue) {
          try {
            tokens = parseFormula(newValue);
          } catch (err) {
            setError(t('Invalid formula: %s', err.message));
          }
        }

        const validationError = validateVariabled(tokens);
        if (validationError) {
          setError(validationError);
          return;
        }

        setError(null);
        onChange(joinTokens(escapeVariables(tokens)));
      }, 200),
    [onChange, validateVariabled]
  );
  return (
    <Tooltip
      position="top-start"
      title={error || ''}
      disabled={!error}
      skipWrapper
      forceVisible={!!error}
    >
      <StyledInput
        {...props}
        hasError={!!error}
        defaultValue={defaultValue}
        onChange={handleChange}
      />
    </Tooltip>
  );
}

const StyledInput = styled(Input)<{hasError: boolean}>`
  ${p =>
    p.hasError &&
    `
    border-color: ${p.theme.error};
    &:focus {
      border-color: ${p.theme.errorFocus};
      box-shadow: none;
    }
  `}
`;
