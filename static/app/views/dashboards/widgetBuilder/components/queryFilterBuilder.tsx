import {Fragment, useCallback, useState} from 'react';
import styled from '@emotion/styled';
import cloneDeep from 'lodash/cloneDeep';

import {Button} from 'sentry/components/button';
import Input from 'sentry/components/input';
import {IconAdd, IconDelete} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {
  createOnDemandFilterWarning,
  shouldDisplayOnDemandWidgetWarning,
} from 'sentry/utils/onDemandMetrics';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';
import {getDatasetConfig} from 'sentry/views/dashboards/datasetConfig/base';
import {DisplayType, WidgetType} from 'sentry/views/dashboards/types';
import {SectionHeader} from 'sentry/views/dashboards/widgetBuilder/components/common/sectionHeader';
import {useWidgetBuilderContext} from 'sentry/views/dashboards/widgetBuilder/contexts/widgetBuilderContext';
import {BuilderStateAction} from 'sentry/views/dashboards/widgetBuilder/hooks/useWidgetBuilderState';
import {getDiscoverDatasetFromWidgetType} from 'sentry/views/dashboards/widgetBuilder/utils';
import {convertBuilderStateToWidget} from 'sentry/views/dashboards/widgetBuilder/utils/convertBuilderStateToWidget';

interface WidgetBuilderQueryFilterBuilderProps {
  onQueryConditionChange: (valid: boolean) => void;
}

function WidgetBuilderQueryFilterBuilder({
  onQueryConditionChange,
}: WidgetBuilderQueryFilterBuilderProps) {
  const {state, dispatch} = useWidgetBuilderContext();
  const {selection} = usePageFilters();
  const organization = useOrganization();

  const [queryConditionValidity, setQueryConditionValidity] = useState<boolean[]>(() => {
    // Make a validity entry for each query condition initially
    return state.query?.map(() => true) ?? [];
  });

  const widgetType = state.dataset ?? WidgetType.ERRORS;
  const datasetConfig = getDatasetConfig(state.dataset);

  const widget = convertBuilderStateToWidget(state);

  const canAddSearchConditions =
    state.displayType !== DisplayType.TABLE &&
    state.displayType !== DisplayType.BIG_NUMBER;

  const onAddSearchConditions = () => {
    // TODO: after hook gets updated with different dispatch types, change this part
    dispatch({
      type: BuilderStateAction.SET_QUERY,
      payload: state.query?.length ? [...state.query, ''] : ['', ''],
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
    },
    [dispatch, queryConditionValidity, state.query, onQueryConditionChange]
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
      {!state.query?.length ? (
        <QueryFieldRowWrapper key={0}>
          <datasetConfig.SearchBar
            getFilterWarning={
              shouldDisplayOnDemandWidgetWarning(
                widget.queries[0],
                widgetType,
                organization
              )
                ? getOnDemandFilterWarning
                : undefined
            }
            pageFilters={selection}
            onClose={handleClose(0)}
            onSearch={queryString => {
              dispatch({
                type: BuilderStateAction.SET_QUERY,
                payload: [queryString],
              });
            }}
            widgetQuery={widget.queries[0]}
            dataset={getDiscoverDatasetFromWidgetType(widgetType)}
          />
          {canAddSearchConditions && (
            // TODO: Hook up alias to query hook when it's implemented
            <LegendAliasInput
              type="text"
              name="name"
              placeholder={t('Legend Alias')}
              onChange={() => {}}
            />
          )}
        </QueryFieldRowWrapper>
      ) : (
        state.query?.map((_, index) => (
          <QueryFieldRowWrapper key={index}>
            <datasetConfig.SearchBar
              getFilterWarning={
                shouldDisplayOnDemandWidgetWarning(
                  widget.queries[index],
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
              }}
              widgetQuery={widget.queries[index]}
              dataset={getDiscoverDatasetFromWidgetType(widgetType)}
            />
            {canAddSearchConditions && (
              // TODO: Hook up alias to query hook when it's implemented
              <LegendAliasInput
                type="text"
                name="name"
                placeholder={t('Legend Alias')}
                onChange={() => {}}
              />
            )}
            {state.query && state.query?.length > 1 && canAddSearchConditions && (
              <DeleteButton onDelete={handleRemove(index)} />
            )}
          </QueryFieldRowWrapper>
        ))
      )}
      {canAddSearchConditions && (
        <Button size="sm" icon={<IconAdd isCircled />} onClick={onAddSearchConditions}>
          {t('Add Filter')}
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
