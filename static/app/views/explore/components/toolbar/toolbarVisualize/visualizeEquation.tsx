import {useCallback, type ReactNode} from 'react';
import {useSortable} from '@dnd-kit/sortable';
import {CSS} from '@dnd-kit/utilities';

import {Button} from '@sentry/scraps/button';
import {Flex} from '@sentry/scraps/layout';

import type {Expression} from 'sentry/components/arithmeticBuilder/expression';
import {DragReorderButton} from 'sentry/components/dnd/dragReorderButton';
import {IconDelete} from 'sentry/icons/iconDelete';
import {t} from 'sentry/locale';
import {EQUATION_PREFIX, stripEquationPrefix} from 'sentry/utils/discover/fields';
import {ExploreEquationArithmeticBuilder} from 'sentry/views/explore/components/exploreEquationArithmeticBuilder';
import {ToolbarRow} from 'sentry/views/explore/components/toolbar/styles';
import {useSpanItemAttributes} from 'sentry/views/explore/hooks/useTraceItemAttributes';
import {Visualize} from 'sentry/views/explore/queryParams/visualize';
import {TraceItemDataset} from 'sentry/views/explore/types';

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

  const handleExpressionChange = useCallback(
    (newExpression: Expression) => {
      const newVisualize = visualize.replace({
        yAxis: `${EQUATION_PREFIX}${newExpression.text}`,
      });
      onReplace(newVisualize);
    },
    [onReplace, visualize]
  );

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
        <DragReorderButton iconSize="sm" {...listeners} />
      )}
      {label}
      <Flex flex={1}>
        <ExploreEquationArithmeticBuilder
          expression={expression}
          setExpression={handleExpressionChange}
          traceItemType={TraceItemDataset.SPANS}
          numberTags={numberTags}
          stringTags={stringTags}
          booleanTags={booleanTags}
        />
      </Flex>
      {onDelete && (
        <Button
          variant="transparent"
          icon={<IconDelete />}
          size="zero"
          onClick={onDelete}
          aria-label={t('Remove Overlay')}
        />
      )}
    </ToolbarRow>
  );
}
