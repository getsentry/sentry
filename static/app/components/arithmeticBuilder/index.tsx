import {useMemo} from 'react';
import {css} from '@emotion/react';
import styled from '@emotion/styled';

import {Input} from '@sentry/scraps/input';

import {useArithmeticBuilderAction} from 'sentry/components/arithmeticBuilder/action';
import {ArithmeticBuilderContext} from 'sentry/components/arithmeticBuilder/context';
import type {Expression} from 'sentry/components/arithmeticBuilder/expression';
import {TokenGrid} from 'sentry/components/arithmeticBuilder/token/grid';
import type {FunctionArgument} from 'sentry/components/arithmeticBuilder/types';
import type {FieldDefinition} from 'sentry/utils/fields';
import {FieldKind} from 'sentry/utils/fields';
import {PanelProvider} from 'sentry/utils/panelProvider';

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
  /**
   * When provided, the arithmetic builder will use the references to suggest
   * keys for the user instead of aggregations and function arguments.
   */
  references?: Set<string>;
  setExpression?: (expression: Expression) => void;
}

const VALID_REFERENCE_PATTERN = /^[A-Z]$/;

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
  references,
}: ArithmeticBuilderProps) {
  if (references) {
    for (const reference of references) {
      if (!VALID_REFERENCE_PATTERN.test(reference)) {
        throw new Error(`Invalid reference: ${reference}`);
      }
    }
  }

  const {state, dispatch} = useArithmeticBuilderAction({
    initialExpression: expression || '',
    references,
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
      references,
    };
  }, [
    state,
    dispatch,
    aggregations,
    functionArguments,
    getFieldDefinition,
    getSuggestedKey,
    references,
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
  font-size: ${p => p.theme.font.size.md};
  cursor: text;

  ${p =>
    p.state === 'valid'
      ? css`
          :focus-within {
            border: 1px solid ${p.theme.tokens.focus.default};
            box-shadow: 0 0 0 1px ${p.theme.tokens.focus.default};
          }
        `
      : p.state === 'invalid'
        ? css`
            :focus-within {
              border: 1px solid ${p.theme.tokens.focus.invalid};
              box-shadow: 0 0 0 1px ${p.theme.tokens.focus.invalid};
            }
          `
        : ''}
`;
