import {useCallback} from 'react';

import useCopyToClipboard from 'sentry/utils/useCopyToClipboard';
import {useLocation} from 'sentry/utils/useLocation';
import {Actions} from 'sentry/views/explore/hooks/useAttributeBreakdownsTooltip';
import {
  useAddSearchFilter,
  useQueryParamsVisualizes,
  useSetQueryParamsGroupBys,
} from 'sentry/views/explore/queryParams/context';
import {Mode} from 'sentry/views/explore/queryParams/mode';
import {useSpansDataset} from 'sentry/views/explore/spans/spansQueryParams';

import {AttributeDistribution} from './attributeDistributionContent';
import {useChartSelection} from './chartSelectionContext';
import {CohortComparison} from './cohortComparisonContent';

export function AttributeBreakdownsContent() {
  const {chartSelection} = useChartSelection();
  const location = useLocation();
  const visualizes = useQueryParamsVisualizes();
  const addSearchFilter = useAddSearchFilter();
  const setGroupBys = useSetQueryParamsGroupBys();
  const copyToClipboard = useCopyToClipboard();
  const dataset = useSpansDataset();

  const query = location.query.query?.toString() ?? '';
  const extrapolate = location.query.extrapolate?.toString() ?? '1';

  const onAction = useCallback(
    ({action, key, value}: {action: string; key: string; value: string}) => {
      switch (action) {
        case Actions.GROUP_BY:
          setGroupBys([key], Mode.AGGREGATE);
          break;
        case Actions.ADD_TO_FILTER:
          addSearchFilter({key, value});
          break;
        case Actions.EXCLUDE_FROM_FILTER:
          addSearchFilter({key, value, negated: true});
          break;
        case Actions.COPY_TO_CLIPBOARD:
          copyToClipboard.copy(value);
          break;
        default:
          break;
      }
    },
    [addSearchFilter, setGroupBys, copyToClipboard]
  );

  if (chartSelection) {
    const yAxis = visualizes[chartSelection.chartIndex]?.yAxis ?? '';

    return (
      <CohortComparison
        selection={chartSelection.selection}
        yAxis={yAxis}
        query={query}
        dataset={dataset}
        extrapolate={extrapolate}
        onAction={onAction}
      />
    );
  }

  return <AttributeDistribution />;
}
