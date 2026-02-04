import {useCallback, useMemo} from 'react';

import {ArithmeticBuilder} from 'sentry/components/arithmeticBuilder';
import type {Expression} from 'sentry/components/arithmeticBuilder/expression';
import type {FunctionArgument} from 'sentry/components/arithmeticBuilder/types';
import {stripEquationPrefix} from 'sentry/utils/discover/fields';
import {
  ALLOWED_EXPLORE_EQUATION_AGGREGATES,
  FieldKind,
  getFieldDefinition,
} from 'sentry/utils/fields';
import {useTraceItemTags} from 'sentry/views/explore/contexts/spanTagsContext';
import {useExploreSuggestedAttribute} from 'sentry/views/explore/hooks/useExploreSuggestedAttribute';

type Props = {
  equation: string;
  onUpdate: (value: string) => void;
};

export function ExploreArithmeticBuilder({equation, onUpdate}: Props) {
  const expression = stripEquationPrefix(equation);
  const {tags: numberTags} = useTraceItemTags('number');
  const {tags: stringTags} = useTraceItemTags('string');
  const {tags: booleanTags} = useTraceItemTags('boolean');

  const functionArguments: FunctionArgument[] = useMemo(() => {
    return [
      ...Object.entries(numberTags).map(([key, tag]) => {
        return {
          kind: FieldKind.MEASUREMENT,
          name: key,
          label: tag.name,
        };
      }),
      ...Object.entries(stringTags).map(([key, tag]) => {
        return {
          kind: FieldKind.TAG,
          name: key,
          label: tag.name,
        };
      }),
    ];
  }, [numberTags, stringTags]);

  const getSpanFieldDefinition = useCallback(
    (key: string) => {
      const tag = numberTags[key] ?? stringTags[key];
      return getFieldDefinition(key, 'span', tag?.kind);
    },
    [numberTags, stringTags]
  );

  const handleExpressionChange = useCallback(
    (newExpression: Expression) => {
      onUpdate(stripEquationPrefix(newExpression.text));
    },
    [onUpdate]
  );

  const getSuggestedAttribute = useExploreSuggestedAttribute({
    numberAttributes: numberTags,
    stringAttributes: stringTags,
    booleanAttributes: booleanTags,
  });

  return (
    <ArithmeticBuilder
      aggregations={ALLOWED_EXPLORE_EQUATION_AGGREGATES}
      functionArguments={functionArguments}
      getFieldDefinition={getSpanFieldDefinition}
      expression={expression}
      setExpression={handleExpressionChange}
      getSuggestedKey={getSuggestedAttribute}
    />
  );
}
