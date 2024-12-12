import {Fragment, useEffect} from 'react';
import styled from '@emotion/styled';

import SelectControl from 'sentry/components/forms/controls/selectControl';
import FieldGroup from 'sentry/components/forms/fieldGroup';
import {Tooltip} from 'sentry/components/tooltip';
import {t, tn} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {SelectValue} from 'sentry/types/core';
import type {TagCollection} from 'sentry/types/group';
import useTags from 'sentry/utils/useTags';
import {getDatasetConfig} from 'sentry/views/dashboards/datasetConfig/base';
import {DisplayType, WidgetType} from 'sentry/views/dashboards/types';
import {SortBySelectors} from 'sentry/views/dashboards/widgetBuilder/buildSteps/sortByStep/sortBySelectors';
import {SectionHeader} from 'sentry/views/dashboards/widgetBuilder/components/common/sectionHeader';
import {useWidgetBuilderContext} from 'sentry/views/dashboards/widgetBuilder/contexts/widgetBuilderContext';
import {BuilderStateAction} from 'sentry/views/dashboards/widgetBuilder/hooks/useWidgetBuilderState';
import {
  getResultsLimit,
  SortDirection,
} from 'sentry/views/dashboards/widgetBuilder/utils';
import {convertBuilderStateToWidget} from 'sentry/views/dashboards/widgetBuilder/utils/convertBuilderStateToWidget';
import {useSpanTags} from 'sentry/views/explore/contexts/spanTagsContext';

function WidgetBuilderSortBySelector() {
  const {state, dispatch} = useWidgetBuilderContext();
  const widget = convertBuilderStateToWidget(state);

  const datasetConfig = getDatasetConfig(state.dataset);

  let tags: TagCollection = useTags();
  const numericSpanTags = useSpanTags('number');
  const stringSpanTags = useSpanTags('string');
  if (state.dataset === WidgetType.SPANS) {
    tags = {...numericSpanTags, ...stringSpanTags};
  }

  let disableSort = false;
  let disableSortDirection = false;
  let disableSortReason: string | undefined = undefined;

  if (datasetConfig.disableSortOptions) {
    ({disableSort, disableSortDirection, disableSortReason} =
      datasetConfig.disableSortOptions(widget.queries[0]));
  }

  const displayType = state.displayType ?? DisplayType.TABLE;

  const isTimeseriesChart = [
    DisplayType.LINE,
    DisplayType.BAR,
    DisplayType.AREA,
  ].includes(displayType);

  const maxLimit = getResultsLimit(
    widget.queries.length,
    widget.queries[0].aggregates.length
  );

  // handles when the maxLimit changes to a value less than the current selected limit
  useEffect(() => {
    if (!state.limit) {
      return;
    }
    if (state.limit > maxLimit) {
      dispatch({
        type: BuilderStateAction.SET_LIMIT,
        payload: maxLimit,
      });
    }
  }, [state.limit, maxLimit, dispatch]);

  function handleSortByChange(newSortBy: string, sortDirection: 'asc' | 'desc') {
    dispatch({
      type: BuilderStateAction.SET_SORT,
      payload: [{field: newSortBy, kind: sortDirection}],
    });
  }

  return (
    <Fragment>
      <SectionHeader
        title={t('Sort by')}
        tooltipText={t('Results you see first and last in your samples or aggregates')}
      />
      <Tooltip
        title={disableSortReason}
        disabled={!(disableSortDirection && disableSort)}
      >
        <FieldGroup
          inline={false}
          style={{paddingRight: 0}}
          flexibleControlStateSize
          stacked
        >
          {isTimeseriesChart && state.limit && (
            <ResultsLimitSelector
              disabled={disableSortDirection && disableSort}
              name="resultsLimit"
              menuPlacement="auto"
              options={[...Array(maxLimit).keys()].map(resultLimit => {
                const value = resultLimit + 1;
                return {
                  label: tn('Limit to %s result', 'Limit to %s results', value),
                  value,
                };
              })}
              value={state.limit}
              onChange={(option: SelectValue<number>) => {
                dispatch({
                  type: BuilderStateAction.SET_LIMIT,
                  payload: option.value,
                });
              }}
            />
          )}
          <SortBySelectors
            displayType={displayType}
            widgetType={state.dataset ?? WidgetType.ERRORS}
            hasGroupBy={isTimeseriesChart && !!widget.queries[0].columns.length}
            disableSortReason={disableSortReason}
            disableSort={disableSort}
            disableSortDirection={disableSortDirection}
            widgetQuery={widget.queries[0]}
            values={{
              sortDirection:
                state.sort?.[0]?.kind === 'asc'
                  ? SortDirection.LOW_TO_HIGH
                  : SortDirection.HIGH_TO_LOW,
              sortBy: state.sort?.length ? state.sort?.[0]?.field : '',
            }}
            onChange={({sortDirection, sortBy}) => {
              const newSortDirection =
                sortDirection === SortDirection.HIGH_TO_LOW ? 'desc' : 'asc';
              handleSortByChange(sortBy, newSortDirection);
            }}
            tags={tags}
          />
        </FieldGroup>
      </Tooltip>
    </Fragment>
  );
}

export default WidgetBuilderSortBySelector;

const ResultsLimitSelector = styled(SelectControl)`
  margin-bottom: ${space(1)};
`;
