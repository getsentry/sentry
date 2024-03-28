import {useCallback, useEffect, useMemo, useState} from 'react';
import styled from '@emotion/styled';
import debounce from 'lodash/debounce';

import Input, {inputStyles} from 'sentry/components/input';
import {t} from 'sentry/locale';
import {unescapeMetricsFormula} from 'sentry/utils/metrics';
import {FormularFormatter} from 'sentry/views/metrics/formulaParser/formatter';
import {joinTokens, parseFormula} from 'sentry/views/metrics/formulaParser/parser';
import {type TokenList, TokenType} from 'sentry/views/metrics/formulaParser/types';

interface Props extends Omit<React.ComponentProps<typeof Input>, 'onChange' | 'value'> {
  availableVariables: Set<string>;
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

function equalizeWhitespace(formula: TokenList): TokenList {
  return formula.map(token => {
    // Ensure equal spacing
    if (token.type === TokenType.WHITESPACE) {
      return {...token, content: ' '};
    }
    return token;
  });
}
export function FormulaInput({
  availableVariables,
  value: valueProp,
  onChange,
  ...props
}: Props) {
  const [errors, setErrors] = useState<any>([]);
  const [showErrors, setIsValidationEnabled] = useState(false);
  const [value, setValue] = useState<string>(() => unescapeMetricsFormula(valueProp));

  const validateVariable = useCallback(
    (variable: string): string | null => {
      if (!availableVariables.has(variable)) {
        return t('Unknown query "%s"', variable);
      }
      return null;
    },
    [availableVariables]
  );

  const parseAndValidateFormula = useCallback(
    (formula: string): TokenList | null => {
      let tokens: TokenList = [];
      const newErrors: any[] = [];
      if (formula) {
        try {
          tokens = parseFormula(formula);
        } catch (err) {
          newErrors.push({
            message: err.message,
            start: err.location.start.offset,
          });
        }
      }

      // validate variables
      let charCount = 0;
      tokens.forEach(token => {
        if (token.type === TokenType.VARIABLE) {
          const error = validateVariable(token.content);
          if (error) {
            newErrors.push({
              message: error,
              start: charCount,
              end: charCount + token.content.length,
            });
          }
        }
        charCount += token.content.length;
      });

      newErrors.sort((a, b) => a.start - b.start);
      setErrors(newErrors);

      if (newErrors.length > 0) {
        return null;
      }

      return tokens;
    },
    [validateVariable]
  );

  useEffect(() => {
    setIsValidationEnabled(false);

    const timeoutId = setTimeout(() => {
      setIsValidationEnabled(true);
    }, 500);

    return () => {
      clearTimeout(timeoutId);
    };
  }, [value]);

  // Parse and validate formula everytime the validation criteria changes
  useEffect(() => {
    parseAndValidateFormula(value);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [parseAndValidateFormula]);

  const handleChange = useMemo(
    () =>
      debounce((e: React.ChangeEvent<HTMLInputElement>) => {
        const newValue = e.target.value.trim();

        const tokens = parseAndValidateFormula(newValue);

        if (!tokens) {
          return;
        }

        onChange(joinTokens(equalizeWhitespace(escapeVariables(tokens))));
      }, 200),
    [onChange, parseAndValidateFormula]
  );

  return (
    <Wrapper>
      <StyledInput
        {...props}
        monospace
        hasError={showErrors && errors.length > 0}
        defaultValue={value}
        placeholder="e.g. (a / b) * 100"
        onChange={e => {
          setValue(e.target.value);
          handleChange(e);
        }}
      />
      <RendererOverlay monospace>
        <FormularFormatter formula={value} errors={showErrors ? errors : []} />
      </RendererOverlay>
    </Wrapper>
  );
}

const Wrapper = styled('div')`
  position: relative;
`;

const RendererOverlay = styled('div')`
  ${inputStyles}
  border-color: transparent;
  position: absolute;
  top: 0;
  right: 0;
  bottom: 0;
  left: 0;
  align-items: center;
  justify-content: center;
  pointer-events: none;
  background: none;
  white-space: nowrap;
  overflow: hidden;
  resize: none;
`;

const StyledInput = styled(Input)<{hasError: boolean}>`
  caret-color: ${p => p.theme.subText};
  color: transparent;
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
