import {Fragment, useMemo} from 'react';

import {t} from 'sentry/locale';
import type {TagCollection} from 'sentry/types/group';
import {type QueryFieldValue} from 'sentry/utils/discover/fields';
import type {UseApiQueryResult} from 'sentry/utils/queryClient';
import type RequestError from 'sentry/utils/requestError/requestError';
import useOrganization from 'sentry/utils/useOrganization';
import useTags from 'sentry/utils/useTags';
import {getDatasetConfig} from 'sentry/views/dashboards/datasetConfig/base';
import {WidgetType, type ValidateWidgetResponse} from 'sentry/views/dashboards/types';
import {GroupBySelector} from 'sentry/views/dashboards/widgetBuilder/buildSteps/groupByStep/groupBySelector';
import {SectionHeader} from 'sentry/views/dashboards/widgetBuilder/components/common/sectionHeader';
import {useWidgetBuilderContext} from 'sentry/views/dashboards/widgetBuilder/contexts/widgetBuilderContext';
import {useDisableTransactionWidget} from 'sentry/views/dashboards/widgetBuilder/hooks/useDisableTransactionWidget';
import {BuilderStateAction} from 'sentry/views/dashboards/widgetBuilder/hooks/useWidgetBuilderState';
import {useTraceItemTags} from 'sentry/views/explore/contexts/spanTagsContext';
import {useTraceItemAttributesWithConfig} from 'sentry/views/explore/contexts/traceItemAttributeContext';
import {HiddenTraceMetricGroupByFields} from 'sentry/views/explore/metrics/constants';
import {TraceItemDataset} from 'sentry/views/explore/types';

interface WidgetBuilderGroupBySelectorProps {
  validatedWidgetResponse: UseApiQueryResult<ValidateWidgetResponse, RequestError>;
}

function WidgetBuilderGroupBySelector({
  validatedWidgetResponse,
}: WidgetBuilderGroupBySelectorProps) {
  const {state, dispatch} = useWidgetBuilderContext();
  const disableTransactionWidget = useDisableTransactionWidget();

  const organization = useOrganization();

  const tags: TagCollection = useTags();

  let hiddenKeys: string[] = [];
  if (state.dataset === WidgetType.TRACEMETRICS) {
    hiddenKeys = HiddenTraceMetricGroupByFields;
  }
  const {tags: numericSpanTags} = useTraceItemTags('number', hiddenKeys);
  const {tags: stringSpanTags} = useTraceItemTags('string', hiddenKeys);

  const preprodAttributeConfig = {
    traceItemType: TraceItemDataset.PREPROD,
    enabled:
      state.dataset === WidgetType.PREPROD_APP_SIZE &&
      organization.features.includes('preprod-app-size-dashboard'),
  };
  const {attributes: preprodStringAttributes} = useTraceItemAttributesWithConfig(
    preprodAttributeConfig,
    'string'
  );

  const groupByOptions = useMemo(() => {
    const datasetConfig = getDatasetConfig(state.dataset);
    if (!datasetConfig.getGroupByFieldOptions) {
      return {};
    }

    if (
      state.dataset === WidgetType.SPANS ||
      state.dataset === WidgetType.LOGS ||
      state.dataset === WidgetType.TRACEMETRICS
    ) {
      return datasetConfig.getGroupByFieldOptions(organization, {
        ...numericSpanTags,
        ...stringSpanTags,
      });
    }

    if (state.dataset === WidgetType.PREPROD_APP_SIZE) {
      return datasetConfig.getGroupByFieldOptions(organization, preprodStringAttributes);
    }

    return datasetConfig.getGroupByFieldOptions(organization, tags);
  }, [
    numericSpanTags,
    organization,
    preprodStringAttributes,
    state.dataset,
    stringSpanTags,
    tags,
  ]);

  const handleGroupByChange = (newValue: QueryFieldValue[]) => {
    dispatch({type: BuilderStateAction.SET_FIELDS, payload: newValue});
  };

  return (
    <Fragment>
      <SectionHeader
        title={t('Group by')}
        tooltipText={t(
          'Aggregated data by a key attribute to calculate averages, percentiles, count and more'
        )}
        optional
      />

      <GroupBySelector
        columns={state.fields}
        fieldOptions={groupByOptions}
        onChange={handleGroupByChange}
        validatedWidgetResponse={validatedWidgetResponse}
        style={{paddingRight: 0}}
        widgetType={state.dataset}
        disable={disableTransactionWidget}
      />
    </Fragment>
  );
}

export default WidgetBuilderGroupBySelector;
