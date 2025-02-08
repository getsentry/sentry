import {Fragment, useCallback, useState} from 'react';
import styled from '@emotion/styled';
import cloneDeep from 'lodash/cloneDeep';

import {Button} from 'sentry/components/button';
import Input from 'sentry/components/input';
import {IconDelete} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {trackAnalytics} from 'sentry/utils/analytics';
import {WidgetBuilderVersion} from 'sentry/utils/analytics/dashboardsAnalyticsEvents';
import {
  createOnDemandFilterWarning,
  shouldDisplayOnDemandWidgetWarning,
} from 'sentry/utils/onDemandMetrics';
import type {UseApiQueryResult} from 'sentry/utils/queryClient';
import type RequestError from 'sentry/utils/requestError/requestError';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';
import {getDatasetConfig} from 'sentry/views/dashboards/datasetConfig/base';
import {
  DisplayType,
  type ValidateWidgetResponse,
  WidgetType,
} from 'sentry/views/dashboards/types';
import {WidgetOnDemandQueryWarning} from 'sentry/views/dashboards/widgetBuilder/buildSteps/filterResultsStep';
import {SectionHeader} from 'sentry/views/dashboards/widgetBuilder/components/common/sectionHeader';
import {useWidgetBuilderContext} from 'sentry/views/dashboards/widgetBuilder/contexts/widgetBuilderContext';
import useDashboardWidgetSource from 'sentry/views/dashboards/widgetBuilder/hooks/useDashboardWidgetSource';
import useIsEditingWidget from 'sentry/views/dashboards/widgetBuilder/hooks/useIsEditingWidget';
import {BuilderStateAction} from 'sentry/views/dashboards/widgetBuilder/hooks/useWidgetBuilderState';
import {getDiscoverDatasetFromWidgetType} from 'sentry/views/dashboards/widgetBuilder/utils';
import {convertBuilderStateToWidget} from 'sentry/views/dashboards/widgetBuilder/utils/convertBuilderStateToWidget';

interface WidgetBuilderQueryFilterBuilderProps {
  onQueryConditionChange: (valid: boolean) => void;
  validatedWidgetResponse: UseApiQueryResult<ValidateWidgetResponse, RequestError>;
}

function WidgetBuilderQueryFilterBuilder({
  onQueryConditionChange,
  validatedWidgetResponse,
}: WidgetBuilderQueryFilterBuilderProps) {
  const {state, dispatch} = useWidgetBuilderContext();
  const {selection} = usePageFilters();
  const organization = useOrganization();
  const [queryConditionValidity, setQueryConditionValidity] = useState<boolean[]>(() => {
    // Make a validity entry for each query condition initially
    return state.query?.map(() => true) ?? [];
  });
  const source = useDashboardWidgetSource();
  const isEditing = useIsEditingWidget();

  const widgetType = state.dataset ?? WidgetType.ERRORS;
  const datasetConfig = getDatasetConfig(state.dataset);

  const widget = convertBuilderStateToWidget(state);

  const canAddSearchConditions =
    state.displayType !== DisplayType.TABLE &&
    state.displayType !== DisplayType.BIG_NUMBER &&
    state.dataset !== WidgetType.SPANS &&
    state.query &&
    state.query.length < 3;

  const canHaveAlias =
    state.displayType !== DisplayType.TABLE &&
    state.displayType !== DisplayType.BIG_NUMBER;

  const onAddSearchConditions = () => {
    // TODO: after hook gets updated with different dispatch types, change this part
    dispatch({
      type: BuilderStateAction.SET_QUERY,
      payload: state.query?.length ? [...state.query, ''] : ['', ''],
    });

    dispatch({
      type: BuilderStateAction.SET_LEGEND_ALIAS,
      payload: state.legendAlias?.length ? [...state.legendAlias, ''] : ['', ''],
    });
    trackAnalytics('dashboards_views.widget_builder.change', {
      builder_version: WidgetBuilderVersion.SLIDEOUT,
      field: 'filter.add',
      from: source,
      new_widget: !isEditing,
      value: '',
      widget_type: state.dataset ?? '',
      organization,
    });
  };

  const handleClose = useCallback(
    (queryIndex: number) => {
      return (field: string, props: any) => {
        const {validSearch} = props;
        const nextQueryConditionValidity = cloneDeep(queryConditionValidity);
        nextQueryConditionValidity[queryIndex] = validSearch;
        setQueryConditionValidity(nextQueryConditionValidity);
        onQueryConditionChange(nextQueryConditionValidity.every(validity => validity));
        dispatch({
          type: BuilderStateAction.SET_QUERY,
          payload: state.query?.map((q, i) => (i === queryIndex ? field : q)) ?? [],
        });
      };
    },
    [dispatch, queryConditionValidity, state.query, onQueryConditionChange]
  );

  const handleRemove = useCallback(
    (queryIndex: number) => () => {
      queryConditionValidity.splice(queryIndex, 1);
      setQueryConditionValidity(queryConditionValidity);
      onQueryConditionChange(queryConditionValidity.every(validity => validity));
      dispatch({
        type: BuilderStateAction.SET_QUERY,
        payload: state.query?.filter((_, i) => i !== queryIndex) ?? [],
      });
      dispatch({
        type: BuilderStateAction.SET_LEGEND_ALIAS,
        payload: state.legendAlias?.filter((_, i) => i !== queryIndex) ?? [],
      });
      trackAnalytics('dashboards_views.widget_builder.change', {
        builder_version: WidgetBuilderVersion.SLIDEOUT,
        field: 'filter.delete',
        from: source,
        new_widget: !isEditing,
        value: '',
        widget_type: state.dataset ?? '',
        organization,
      });
    },
    [
      dispatch,
      queryConditionValidity,
      state.query,
      onQueryConditionChange,
      state.legendAlias,
      state.dataset,
      source,
      isEditing,
      organization,
    ]
  );

  const getOnDemandFilterWarning = createOnDemandFilterWarning(
    tct(
      'We don’t routinely collect metrics from this property. However, we’ll do so [strong:once this widget has been saved.]',
      {
        strong: <strong />,
      }
    )
  );

  return (
    <Fragment>
      <SectionHeader
        title={t('Filter')}
        tooltipText={
          canAddSearchConditions
            ? t(
                'Filter down your search here. You can add multiple queries to compare data for each overlay'
              )
            : t('Filter down your search here')
        }
        optional
      />
      {state.query?.map((_, index) => (
        <QueryFieldRowWrapper key={index}>
          <datasetConfig.SearchBar
            getFilterWarning={
              shouldDisplayOnDemandWidgetWarning(
                widget.queries[index]!,
                widgetType,
                organization
              )
                ? getOnDemandFilterWarning
                : undefined
            }
            pageFilters={selection}
            onClose={handleClose(index)}
            onSearch={queryString => {
              dispatch({
                type: BuilderStateAction.SET_QUERY,
                payload:
                  state.query?.map((q, i) => (i === index ? queryString : q)) ?? [],
              });
              trackAnalytics('dashboards_views.widget_builder.change', {
                builder_version: WidgetBuilderVersion.SLIDEOUT,
                field: 'filter.update',
                from: source,
                new_widget: !isEditing,
                value: '',
                widget_type: state.dataset ?? '',
                organization,
              });
            }}
            widgetQuery={widget.queries[index]!}
            dataset={getDiscoverDatasetFromWidgetType(widgetType)}
          />
          {canHaveAlias && (
            <LegendAliasInput
              type="text"
              name="name"
              placeholder={t('Legend Alias')}
              value={state.legendAlias?.[index] || ''}
              onChange={e => {
                dispatch({
                  type: BuilderStateAction.SET_LEGEND_ALIAS,
                  payload: state.legendAlias?.length
                    ? state.legendAlias?.map((q, i) => (i === index ? e.target.value : q))
                    : [e.target.value],
                });
              }}
              onBlur={() => {
                trackAnalytics('dashboards_views.widget_builder.change', {
                  builder_version: WidgetBuilderVersion.SLIDEOUT,
                  field: 'filter.alias',
                  from: source,
                  new_widget: !isEditing,
                  value: '',
                  widget_type: state.dataset ?? '',
                  organization,
                });
              }}
            />
          )}
          {shouldDisplayOnDemandWidgetWarning(
            widget.queries[index]!,
            widgetType,
            organization
          ) && (
            <WidgetOnDemandQueryWarning
              query={widget.queries[index]!}
              validatedWidgetResponse={validatedWidgetResponse}
              queryIndex={index}
            />
          )}
          {state.query && state.query?.length > 1 && (
            <DeleteButton onDelete={handleRemove(index)} />
          )}
        </QueryFieldRowWrapper>
      ))}
      {canAddSearchConditions && (
        <Button
          size="sm"
          priority="link"
          onClick={onAddSearchConditions}
          aria-label={t('Add Filter')}
        >
          {t('+ Add Filter')}
        </Button>
      )}
    </Fragment>
  );
}

export default WidgetBuilderQueryFilterBuilder;

export function DeleteButton({onDelete}: {onDelete: () => void}) {
  return (
    <Button
      size="zero"
      style={{height: 'fit-content'}}
      borderless
      onClick={onDelete}
      icon={<IconDelete />}
      title={t('Remove this filter')}
      aria-label={t('Remove this filter')}
      name="filter-delete-button"
    />
  );
}

const QueryFieldRowWrapper = styled('div')`
  display: flex;
  flex-direction: row;
  gap: ${space(1)};
  margin-bottom: ${space(1)};
  align-items: center;
`;

const LegendAliasInput = styled(Input)`
  width: 33%;
`;
