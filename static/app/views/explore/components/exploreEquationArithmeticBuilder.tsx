import {ArithmeticBuilder} from 'sentry/components/arithmeticBuilder';
import type {Expression} from 'sentry/components/arithmeticBuilder/expression';
import type {TagCollection} from 'sentry/types/group';
import {useExploreEquationBuilderConfig} from 'sentry/views/explore/hooks/useExploreEquationBuilderConfig';
import type {TraceItemDataset} from 'sentry/views/explore/types';

interface ExploreEquationArithmeticBuilderProps {
  booleanTags: TagCollection;
  expression: string;
  numberTags: TagCollection;
  setExpression: (expression: Expression) => void;
  stringTags: TagCollection;
  traceItemType: TraceItemDataset;
  ['data-test-id']?: string;
}

/**
 * Shared ArithmeticBuilder wiring for Explore equation editors (toolbar, column
 * editor, dashboards widget builder).
 */
export function ExploreEquationArithmeticBuilder({
  expression,
  setExpression,
  traceItemType,
  numberTags,
  stringTags,
  booleanTags,
  'data-test-id': dataTestId,
}: ExploreEquationArithmeticBuilderProps) {
  const {
    aggregations,
    functionArguments,
    getFieldDefinition,
    getFilterTagValues,
    getSuggestedKey,
  } = useExploreEquationBuilderConfig({
    traceItemType,
    numberTags,
    stringTags,
    booleanTags,
  });

  return (
    <ArithmeticBuilder
      data-test-id={dataTestId}
      aggregations={aggregations}
      functionArguments={functionArguments}
      getFieldDefinition={getFieldDefinition}
      getFilterTagValues={getFilterTagValues}
      expression={expression}
      setExpression={setExpression}
      getSuggestedKey={getSuggestedKey}
    />
  );
}
