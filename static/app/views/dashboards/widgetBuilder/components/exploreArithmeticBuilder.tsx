import {useCallback} from 'react';

import type {Expression} from 'sentry/components/arithmeticBuilder/expression';
import {stripEquationPrefix} from 'sentry/utils/discover/fields';
import {useWidgetBuilderTraceItemConfig} from 'sentry/views/dashboards/widgetBuilder/hooks/useWidgetBuilderTraceItemConfig';
import {ExploreEquationArithmeticBuilder} from 'sentry/views/explore/components/exploreEquationArithmeticBuilder';
import {useTraceItemDatasetAttributes} from 'sentry/views/explore/hooks/useTraceItemAttributes';

type Props = {
  equation: string;
  onUpdate: (value: string) => void;
};

export function ExploreArithmeticBuilder({equation, onUpdate}: Props) {
  const expression = stripEquationPrefix(equation);
  const {traceItemType, ...traceItemOptions} = useWidgetBuilderTraceItemConfig();
  const {attributes: numberTags} = useTraceItemDatasetAttributes(
    traceItemType,
    traceItemOptions,
    'number'
  );
  const {attributes: stringTags} = useTraceItemDatasetAttributes(
    traceItemType,
    traceItemOptions,
    'string'
  );
  const {attributes: booleanTags} = useTraceItemDatasetAttributes(
    traceItemType,
    traceItemOptions,
    'boolean'
  );

  const handleExpressionChange = useCallback(
    (newExpression: Expression) => {
      onUpdate(stripEquationPrefix(newExpression.text));
    },
    [onUpdate]
  );

  return (
    <ExploreEquationArithmeticBuilder
      expression={expression}
      setExpression={handleExpressionChange}
      traceItemType={traceItemType}
      numberTags={numberTags}
      stringTags={stringTags}
      booleanTags={booleanTags}
    />
  );
}
