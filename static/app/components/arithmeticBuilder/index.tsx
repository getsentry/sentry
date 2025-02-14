import {useMemo} from 'react';
import {css} from '@emotion/react';
import styled from '@emotion/styled';

import {useArithmeticBuilderAction} from 'sentry/components/arithmeticBuilder/action';
import {ArithmeticBuilderContext} from 'sentry/components/arithmeticBuilder/context';
import {TokenGrid} from 'sentry/components/arithmeticBuilder/token/grid';
import {tokenizeExpression} from 'sentry/components/arithmeticBuilder/tokenizer';
import {validateTokens} from 'sentry/components/arithmeticBuilder/validator';
import {inputStyles} from 'sentry/components/input';
import PanelProvider from 'sentry/utils/panelProvider';

export interface ArithmeticBuilderProps {
  expression: string;
  className?: string;
  disabled?: boolean;
}

export function ArithmeticBuilder({
  expression,
  className,
  disabled,
}: ArithmeticBuilderProps) {
  const {state, dispatch} = useArithmeticBuilderAction({
    initialQuery: expression || '',
  });

  const tokens = useMemo(() => tokenizeExpression(state.query), [state.query]);

  const validated = useMemo(() => {
    return validateTokens(tokens) ? ('valid' as const) : ('invalid' as const);
  }, [tokens]);

  const contextValue = useMemo(() => {
    return {
      dispatch,
      focusOverride: state.focusOverride,
    };
  }, [state, dispatch]);

  return (
    <PanelProvider>
      <ArithmeticBuilderContext.Provider value={contextValue}>
        <Wrapper
          className={className}
          aria-disabled={disabled}
          data-test-id="arithmetic-builder"
          state={validated}
        >
          <TokenGrid tokens={tokens} />
        </Wrapper>
      </ArithmeticBuilderContext.Provider>
    </PanelProvider>
  );
}

const Wrapper = styled('div')<{state: 'valid' | 'invalid'}>`
  ${inputStyles}
  min-height: 38px;
  padding: 0;
  height: auto;
  width: 100%;
  position: relative;
  font-size: ${p => p.theme.fontSizeMedium};
  cursor: text;

  ${p =>
    p.state === 'valid'
      ? css`
          :focus-within {
            border: 1px solid ${p.theme.focusBorder};
            box-shadow: 0 0 0 1px ${p.theme.focusBorder};
          }
        `
      : p.state === 'invalid'
        ? css`
            :focus-within {
              border: 1px solid ${p.theme.errorFocus};
              box-shadow: 0 0 0 1px ${p.theme.errorFocus};
            }
          `
        : ''}
`;
