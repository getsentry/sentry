import {useCallback, useMemo, type ReactNode} from 'react';
import {useSortable} from '@dnd-kit/sortable';
import {CSS} from '@dnd-kit/utilities';

import {Button} from '@sentry/scraps/button';
import {Flex} from '@sentry/scraps/layout';

import {ArithmeticBuilder} from 'sentry/components/arithmeticBuilder';
import type {Expression} from 'sentry/components/arithmeticBuilder/expression';
import type {FunctionArgument} from 'sentry/components/arithmeticBuilder/types';
import {IconDelete} from 'sentry/icons/iconDelete';
import {IconGrabbable} from 'sentry/icons/iconGrabbable';
import {t} from 'sentry/locale';
import {EQUATION_PREFIX, stripEquationPrefix} from 'sentry/utils/discover/fields';
import {
  ALLOWED_EXPLORE_EQUATION_AGGREGATES,
  FieldKind,
  getFieldDefinition,
} from 'sentry/utils/fields';
import {ToolbarRow} from 'sentry/views/explore/components/toolbar/styles';
import {useSpanItemAttributes} from 'sentry/views/explore/contexts/traceItemAttributeContext';
import {useExploreSuggestedAttribute} from 'sentry/views/explore/hooks/useExploreSuggestedAttribute';
import {Visualize} from 'sentry/views/explore/queryParams/visualize';

interface VisualizeEquationProps {
  onReplace: (visualize: Visualize) => void;
  visualize: Visualize;
  dragColumnId?: number;
  label?: ReactNode;
  onDelete?: () => void;
}

export function VisualizeEquation({
  dragColumnId,
  onDelete,
  onReplace,
  visualize,
  label,
}: VisualizeEquationProps) {
  const expression = stripEquationPrefix(visualize.yAxis);

  const {attributes: numberTags} = useSpanItemAttributes({}, 'number');
  const {attributes: stringTags} = useSpanItemAttributes({}, 'string');
  const {attributes: booleanTags} = useSpanItemAttributes({}, 'boolean');

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
      onReplace(newVisualize);
    },
    [onReplace, visualize]
  );

  const getSuggestedAttribute = useExploreSuggestedAttribute({
    numberAttributes: numberTags,
    stringAttributes: stringTags,
    booleanAttributes: booleanTags,
  });

  const {attributes, listeners, setNodeRef, transform} = useSortable({
    id: dragColumnId ?? 0,
    transition: null,
  });

  return (
    <ToolbarRow
      ref={setNodeRef}
      style={{transform: CSS.Transform.toString(transform)}}
      {...attributes}
    >
      {dragColumnId === undefined ? null : (
        <Button
          aria-label={t('Drag to reorder')}
          priority="transparent"
          size="zero"
          icon={<IconGrabbable size="sm" />}
          {...listeners}
        />
      )}
      {label}
      <Flex flex={1}>
        <ArithmeticBuilder
          aggregations={ALLOWED_EXPLORE_EQUATION_AGGREGATES}
          functionArguments={functionArguments}
          getFieldDefinition={getSpanFieldDefinition}
          expression={expression}
          setExpression={handleExpressionChange}
          getSuggestedKey={getSuggestedAttribute}
        />
      </Flex>
      {onDelete && (
        <Button
          priority="transparent"
          icon={<IconDelete />}
          size="zero"
          onClick={onDelete}
          aria-label={t('Remove Overlay')}
        />
      )}
    </ToolbarRow>
  );
}
