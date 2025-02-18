import {useMemo} from 'react';
import {css} from '@emotion/react';
import styled from '@emotion/styled';

import {useArithmeticBuilderAction} from 'sentry/components/arithmeticBuilder/action';
import {ArithmeticBuilderContext} from 'sentry/components/arithmeticBuilder/context';
import {TokenGrid} from 'sentry/components/arithmeticBuilder/token/grid';
import {inputStyles} from 'sentry/components/input';
import PanelProvider from 'sentry/utils/panelProvider';

export interface ArithmeticBuilderProps {
  expression: string;
  className?: string;
  disabled?: boolean;
  setExpression?: (expression: string) => void;
}

export function ArithmeticBuilder({
  expression,
  setExpression,
  className,
  disabled,
}: ArithmeticBuilderProps) {
  const {state, dispatch} = useArithmeticBuilderAction({
    initialExpression: expression || '',
    setExpression,
  });

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
          state={state.validated}
        >
          <TokenGrid tokens={state.tokens} />
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
