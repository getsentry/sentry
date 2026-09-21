import {useCallback, useMemo, useRef, useState} from 'react';
import {css} from '@emotion/react';
import styled from '@emotion/styled';

import {Input} from '@sentry/scraps/input';
import {Container} from '@sentry/scraps/layout';

import {useArithmeticBuilderAction} from 'sentry/components/arithmeticBuilder/action';
import {ArithmeticBuilderContext} from 'sentry/components/arithmeticBuilder/context';
import type {Expression} from 'sentry/components/arithmeticBuilder/expression';
import {TokenGrid} from 'sentry/components/arithmeticBuilder/token/grid';
import type {FunctionArgument} from 'sentry/components/arithmeticBuilder/types';
import type {GetTagValues} from 'sentry/components/searchQueryBuilder';
import {
  ComboBoxLayoutContext,
  type ComboBoxMenuPresentation,
} from 'sentry/components/tokenizedInput/token/comboBoxLayout';
import type {FieldDefinition} from 'sentry/utils/fields';
import {FieldKind} from 'sentry/utils/fields';
import {PanelProvider} from 'sentry/utils/panelProvider';
import {useDimensions} from 'sentry/utils/useDimensions';

export type {ComboBoxMenuPresentation};

interface ArithmeticBuilderProps {
  aggregations: string[];
  expression: string;
  functionArguments: FunctionArgument[];
  getFieldDefinition: (
    key: string,
    attributeTexts?: readonly string[]
  ) => FieldDefinition | null;
  className?: string;
  'data-test-id'?: string;
  disabled?: boolean;
  /**
   * Fetches tag values for `_if` combinator filter arguments in equations.
   * Only used when `hasConditionalAggregates` is on.
   */
  getFilterTagValues?: GetTagValues;
  /**
   * This is used when a user types in a search key and submits the token.
   * The submission happens when the user types a colon or presses enter.
   * When this happens, this function is used to try to map the user input
   * to a known column.
   */
  getSuggestedKey?: (key: string) => string | null;
  /**
   * Enables the EAP filter-first `_if` argument editor. Should follow
   * `explore-conditional-aggregates`.
   */
  hasConditionalAggregates?: boolean;
  /**
   * Render the equation input and suggestions together in one panel,
   * matching SearchQueryBuilder's `menuPresentation="panel"`.
   */
  menuPresentation?: ComboBoxMenuPresentation;
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
  getFilterTagValues,
  getSuggestedKey,
  hasConditionalAggregates = false,
  menuPresentation = 'floating',
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

  const wrapperRef = useRef<HTMLDivElement>(null);
  const setWrapperRef = useCallback((element: HTMLDivElement | null) => {
    wrapperRef.current = element;
  }, []);
  const panelRef = useRef<HTMLDivElement>(null);
  const [menuContainer, setMenuContainer] = useState<HTMLDivElement | null>(null);
  const {height: builderHeight} = useDimensions({elementRef: wrapperRef});

  const contextValue = useMemo(() => {
    return {
      dispatch,
      focusOverride: state.focusOverride,
      aggregations: aggregations.filter(aggregation => {
        return getFieldDefinition(aggregation)?.kind === FieldKind.FUNCTION;
      }),
      functionArguments,
      getFieldDefinition,
      getFilterTagValues: hasConditionalAggregates ? getFilterTagValues : undefined,
      getSuggestedKey,
      hasConditionalAggregates,
      references,
    };
  }, [
    state,
    dispatch,
    aggregations,
    functionArguments,
    getFieldDefinition,
    getFilterTagValues,
    getSuggestedKey,
    hasConditionalAggregates,
    references,
  ]);

  const layoutValue = useMemo(
    () => ({
      menuPresentation,
      panelRef,
      portalTarget: menuPresentation === 'panel' ? menuContainer : null,
    }),
    [menuContainer, menuPresentation]
  );

  const builder = (
    <PanelProvider>
      <ComboBoxLayoutContext value={layoutValue}>
        <ArithmeticBuilderContext value={contextValue}>
          <Wrapper
            ref={setWrapperRef}
            className={className}
            aria-disabled={disabled}
            data-test-id={dataTestId ?? 'arithmetic-builder'}
            state={state.expression.isValid ? 'valid' : 'invalid'}
            disabled={disabled}
          >
            <TokenGrid tokens={state.expression.tokens} />
          </Wrapper>
        </ArithmeticBuilderContext>
      </ComboBoxLayoutContext>
    </PanelProvider>
  );

  if (menuPresentation !== 'panel') {
    return builder;
  }

  // useDimensions measures clientHeight; include the input's two 1px borders.
  return (
    <Container
      position="relative"
      width="100%"
      minWidth="0"
      height={`${builderHeight + 2}px`}
    >
      <ArithmeticPanel
        ref={panelRef}
        data-test-id="arithmetic-builder-panel"
        position="absolute"
        top="0"
        left="0"
        right="0"
        radius="md"
        onPointerDown={event => {
          if (
            event.target === event.currentTarget ||
            (event.target instanceof Element &&
              event.target.hasAttribute('data-query-builder-menu'))
          ) {
            // Padding is part of the editor; keep focus on the current input/control.
            event.preventDefault();
          }
        }}
      >
        {builder}
        <Container ref={setMenuContainer} data-query-builder-menu />
      </ArithmeticPanel>
    </Container>
  );
}

const ArithmeticPanel = styled(Container)`
  &:has([data-query-builder-menu] [data-overlay]) {
    top: calc(-${p => p.theme.space.sm} - 1px);
    left: calc(-${p => p.theme.space.sm} - 1px);
    right: calc(-${p => p.theme.space.sm} - 1px);
    padding: ${p => p.theme.space.sm};
    background: ${p => p.theme.tokens.background.overlay};
    border: 1px solid ${p => p.theme.tokens.border.primary};
    box-shadow: ${p => p.theme.shadow.medium};
  }

  [data-query-builder-menu]:not(:empty) {
    padding-top: ${p => p.theme.space.sm};
    margin-inline: -${p => p.theme.space.sm};
  }

  [data-query-builder-menu] [data-overlay] {
    width: 100%;
    min-width: 0;
    max-width: 100%;
    border: 0;
    border-radius: 0;
    box-shadow: none;
    background: transparent;
  }

  [data-query-builder-menu] [role='listbox'] {
    width: 100%;
    min-width: 0;
    text-align: left;
  }
`;

const Wrapper = styled(Input.withComponent('div'))<{
  state: 'valid' | 'invalid';
}>`
  min-height: ${p => p.theme.form.md.minHeight};
  padding: 0;
  height: auto;
  width: 100%;
  min-width: 0;
  max-width: 100%;
  position: relative;
  font-size: ${p => p.theme.font.size.md};
  cursor: text;

  ${p =>
    p.disabled &&
    css`
      pointer-events: none;
    `}

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
