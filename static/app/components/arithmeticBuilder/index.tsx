import {useMemo} from 'react';
import {css} from '@emotion/react';
import styled from '@emotion/styled';

import {useArithmeticBuilderAction} from 'sentry/components/arithmeticBuilder/action';
import {ArithmeticBuilderContext} from 'sentry/components/arithmeticBuilder/context';
import type {Expression} from 'sentry/components/arithmeticBuilder/expression';
import {TokenGrid} from 'sentry/components/arithmeticBuilder/token/grid';
import type {FunctionArgument} from 'sentry/components/arithmeticBuilder/types';
import {Input} from 'sentry/components/core/input';
import type {FieldDefinition} from 'sentry/utils/fields';
import {FieldKind} from 'sentry/utils/fields';
import PanelProvider from 'sentry/utils/panelProvider';

interface ArithmeticBuilderProps {
  aggregations: string[];
  expression: string;
  functionArguments: FunctionArgument[];
  getFieldDefinition: (key: string) => FieldDefinition | null;
  className?: string;
  'data-test-id'?: string;
  disabled?: boolean;
  /**
   * This is used when a user types in a search key and submits the token.
   * The submission happens when the user types a colon or presses enter.
   * When this happens, this function is used to try to map the user input
   * to a known column.
   */
  getSuggestedKey?: (key: string) => string | null;
  setExpression?: (expression: Expression) => void;
}

export function ArithmeticBuilder({
  'data-test-id': dataTestId,
  expression,
  setExpression,
  aggregations,
  functionArguments,
  getFieldDefinition,
  getSuggestedKey,
  className,
  disabled,
}: ArithmeticBuilderProps) {
  const {state, dispatch} = useArithmeticBuilderAction({
    initialExpression: expression || '',
    updateExpression: setExpression,
  });

  const contextValue = useMemo(() => {
    return {
      dispatch,
      focusOverride: state.focusOverride,
      aggregations: aggregations.filter(aggregation => {
        return getFieldDefinition(aggregation)?.kind === FieldKind.FUNCTION;
      }),
      functionArguments,
      getFieldDefinition,
      getSuggestedKey,
    };
  }, [
    state,
    dispatch,
    aggregations,
    functionArguments,
    getFieldDefinition,
    getSuggestedKey,
  ]);

  return (
    <PanelProvider>
      <ArithmeticBuilderContext value={contextValue}>
        <Wrapper
          className={className}
          aria-disabled={disabled}
          data-test-id={dataTestId ?? 'arithmetic-builder'}
          state={state.expression.isValid ? 'valid' : 'invalid'}
        >
          <TokenGrid tokens={state.expression.tokens} />
        </Wrapper>
      </ArithmeticBuilderContext>
    </PanelProvider>
  );
}

const Wrapper = styled(Input.withComponent('div'))<{state: 'valid' | 'invalid'}>`
  min-height: 38px;
  padding: 0;
  height: auto;
  width: 100%;
  position: relative;
  font-size: ${p => p.theme.fontSize.md};
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
              border: 1px solid ${p.theme.tokens.border.danger};
              box-shadow: 0 0 0 1px ${p.theme.tokens.border.danger};
            }
          `
        : ''}
`;
