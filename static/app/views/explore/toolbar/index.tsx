import {useCallback} from 'react';
import styled from '@emotion/styled';

import type {SelectOption} from 'sentry/components/core/compactSelect';
import {defined} from 'sentry/utils';
import {ToolbarGroupBy} from 'sentry/views/explore/components/toolbar/toolbarGroupBy';
import {
  useExploreGroupBys,
  useExploreVisualizes,
  useSetExploreGroupBys,
  useSetExploreVisualizes,
} from 'sentry/views/explore/contexts/pageParamsContext';
import {Mode} from 'sentry/views/explore/contexts/pageParamsContext/mode';
import {useTraceItemTags} from 'sentry/views/explore/contexts/spanTagsContext';
import {useGroupByFields} from 'sentry/views/explore/hooks/useGroupByFields';
import {ToolbarSaveAs} from 'sentry/views/explore/toolbar/toolbarSaveAs';
import {ToolbarSortBy} from 'sentry/views/explore/toolbar/toolbarSortBy';
import {ToolbarVisualize} from 'sentry/views/explore/toolbar/toolbarVisualize';
import {TraceItemDataset} from 'sentry/views/explore/types';

type Extras = 'equations';

interface ExploreToolbarProps {
  extras?: Extras[];
  width?: number;
}

export function ExploreToolbar({extras, width}: ExploreToolbarProps) {
  const {tags} = useTraceItemTags('string');

  const visualizes = useExploreVisualizes();
  const setVisualizes = useSetExploreVisualizes();

  const groupBys = useExploreGroupBys();
  const _setGroupBys = useSetExploreGroupBys();
  const setGroupBys = useCallback(
    (columns: string[], op: 'insert' | 'update' | 'delete' | 'reorder') => {
      // automatically switch to aggregates mode when a group by is inserted/updated
      if (op === 'insert' || op === 'update') {
        _setGroupBys(columns, Mode.AGGREGATE);
      } else {
        _setGroupBys(columns);
      }
    },
    [_setGroupBys]
  );
  const options: Array<SelectOption<string>> = useGroupByFields({
    groupBys,
    tags,
    traceItemType: TraceItemDataset.SPANS,
  });

  return (
    <Container width={width}>
      <ToolbarVisualize
        visualizes={visualizes}
        setVisualizes={setVisualizes}
        allowEquations={extras?.includes('equations') || false}
      />
      <ToolbarGroupBy
        allowMultiple
        groupBys={groupBys}
        setGroupBys={setGroupBys}
        options={options}
      />
      <ToolbarSortBy />
      <ToolbarSaveAs />
    </Container>
  );
}

const Container = styled('div')<{width?: number}>`
  ${p => defined(p.width) && `min-width: ${p.width}px;`}
`;
