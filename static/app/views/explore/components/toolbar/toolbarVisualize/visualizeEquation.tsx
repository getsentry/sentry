import {useCallback, type ReactNode} from 'react';
import {useSortable} from '@dnd-kit/sortable';
import {CSS} from '@dnd-kit/utilities';

import {Button} from '@sentry/scraps/button';
import {Stack} from '@sentry/scraps/layout';

import type {Expression} from 'sentry/components/arithmeticBuilder/expression';
import {DragReorderButton} from 'sentry/components/dnd/dragReorderButton';
import {IconDelete} from 'sentry/icons/iconDelete';
import {t} from 'sentry/locale';
import {EQUATION_PREFIX, stripEquationPrefix} from 'sentry/utils/discover/fields';
import {useOrganization} from 'sentry/utils/useOrganization';
import {ExploreEquationArithmeticBuilder} from 'sentry/views/explore/components/exploreEquationArithmeticBuilder';
import {ToolbarRow} from 'sentry/views/explore/components/toolbar/styles';
import {ExpandableFilterSearchBar} from 'sentry/views/explore/components/toolbar/toolbarVisualize/expandableFilterSearchBar';
import {useSpanItemAttributes} from 'sentry/views/explore/hooks/useTraceItemAttributes';
import {Visualize} from 'sentry/views/explore/queryParams/visualize';
import {TraceItemDataset} from 'sentry/views/explore/types';

interface VisualizeEquationProps {
  onReplace: (visualize: Visualize) => void;
  visualize: Visualize;
  deleteLabel?: string;
  dragColumnId?: number;
  label?: ReactNode;
  onDelete?: () => void;
}

export function VisualizeEquation({
  dragColumnId,
  onDelete,
  deleteLabel,
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

  const organization = useOrganization();
  const hasConditionalAggregates = organization.features.includes(
    'explore-conditional-aggregates'
  );

  const equationBuilder = (
    <ExploreEquationArithmeticBuilder
      expression={expression}
      setExpression={handleExpressionChange}
      traceItemType={TraceItemDataset.SPANS}
      numberTags={numberTags}
      stringTags={stringTags}
      booleanTags={booleanTags}
    />
  );

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
      <Stack flex="1" minWidth="0" overflow="visible">
        {hasConditionalAggregates ? (
          <ExpandableFilterSearchBar>{equationBuilder}</ExpandableFilterSearchBar>
        ) : (
          equationBuilder
        )}
      </Stack>
      {onDelete && (
        <Button
          variant="transparent"
          icon={<IconDelete size="sm" />}
          size="zero"
          onClick={onDelete}
          aria-label={deleteLabel ?? t('Remove Overlay')}
        />
      )}
    </ToolbarRow>
  );
}
