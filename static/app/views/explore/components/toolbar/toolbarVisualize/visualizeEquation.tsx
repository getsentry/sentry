import {useCallback, useMemo} from 'react';

import {ArithmeticBuilder} from 'sentry/components/arithmeticBuilder';
import type {Expression} from 'sentry/components/arithmeticBuilder/expression';
import type {FunctionArgument} from 'sentry/components/arithmeticBuilder/types';
import {Button} from 'sentry/components/core/button';
import {IconDelete} from 'sentry/icons/iconDelete';
import {t} from 'sentry/locale';
import {EQUATION_PREFIX, stripEquationPrefix} from 'sentry/utils/discover/fields';
import {
  ALLOWED_EXPLORE_VISUALIZE_AGGREGATES,
  FieldKind,
  getFieldDefinition,
} from 'sentry/utils/fields';
import {ToolbarRow} from 'sentry/views/explore/components/toolbar/styles';
import type {BaseVisualize} from 'sentry/views/explore/contexts/pageParamsContext/visualizes';
import {Visualize} from 'sentry/views/explore/contexts/pageParamsContext/visualizes';
import {useTraceItemTags} from 'sentry/views/explore/contexts/spanTagsContext';
import {useExploreSuggestedAttribute} from 'sentry/views/explore/hooks/useExploreSuggestedAttribute';

interface VisualizeEquationProps {
  onDelete: () => void;
  onReplace: (visualize: BaseVisualize) => void;
  visualize: Visualize;
}

export function VisualizeEquation({
  onDelete,
  onReplace,
  visualize,
}: VisualizeEquationProps) {
  const expression = stripEquationPrefix(visualize.yAxis);

  const {tags: numberTags} = useTraceItemTags('number');
  const {tags: stringTags} = useTraceItemTags('string');

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
      const newVisualize = visualize.replace({
        yAxis: `${EQUATION_PREFIX}${newExpression.text}`,
      });
      onReplace(newVisualize.toJSON());
    },
    [onReplace, visualize]
  );

  const getSuggestedAttribute = useExploreSuggestedAttribute({
    numberAttributes: numberTags,
    stringAttributes: stringTags,
  });

  return (
    <ToolbarRow>
      <ArithmeticBuilder
        aggregations={ALLOWED_EXPLORE_VISUALIZE_AGGREGATES}
        functionArguments={functionArguments}
        getFieldDefinition={getSpanFieldDefinition}
        expression={expression}
        setExpression={handleExpressionChange}
        getSuggestedKey={getSuggestedAttribute}
      />
      <Button
        borderless
        icon={<IconDelete />}
        size="zero"
        onClick={onDelete}
        aria-label={t('Remove Overlay')}
      />
    </ToolbarRow>
  );
}
