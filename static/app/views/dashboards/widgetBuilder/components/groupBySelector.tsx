import {Fragment} from 'react';

import {t} from 'sentry/locale';
import type {TagCollection} from 'sentry/types/group';
import type {QueryFieldValue} from 'sentry/utils/discover/fields';
import type {UseApiQueryResult} from 'sentry/utils/queryClient';
import type RequestError from 'sentry/utils/requestError/requestError';
import useOrganization from 'sentry/utils/useOrganization';
import useTags from 'sentry/utils/useTags';
import {getDatasetConfig} from 'sentry/views/dashboards/datasetConfig/base';
import {type ValidateWidgetResponse, WidgetType} from 'sentry/views/dashboards/types';
import {GroupBySelector} from 'sentry/views/dashboards/widgetBuilder/buildSteps/groupByStep/groupBySelector';
import {SectionHeader} from 'sentry/views/dashboards/widgetBuilder/components/common/sectionHeader';
import {useWidgetBuilderContext} from 'sentry/views/dashboards/widgetBuilder/contexts/widgetBuilderContext';
import {BuilderStateAction} from 'sentry/views/dashboards/widgetBuilder/hooks/useWidgetBuilderState';
import {useSpanTags} from 'sentry/views/explore/contexts/spanTagsContext';

interface WidgetBuilderGroupBySelectorProps {
  validatedWidgetResponse: UseApiQueryResult<ValidateWidgetResponse, RequestError>;
}

function WidgetBuilderGroupBySelector({
  validatedWidgetResponse,
}: WidgetBuilderGroupBySelectorProps) {
  const {state, dispatch} = useWidgetBuilderContext();

  const organization = useOrganization();

  let tags: TagCollection = useTags();
  const numericSpanTags = useSpanTags('number');
  const stringSpanTags = useSpanTags('string');
  if (state.dataset === WidgetType.SPANS) {
    tags = {...numericSpanTags, ...stringSpanTags};
  }

  const datasetConfig = getDatasetConfig(state.dataset);
  const groupByOptions = datasetConfig.getGroupByFieldOptions
    ? datasetConfig.getGroupByFieldOptions(organization, tags)
    : {};

  const handleGroupByChange = (newValue: QueryFieldValue[]) => {
    dispatch({
      type: BuilderStateAction.SET_FIELDS,
      payload: newValue,
    });
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
      />
    </Fragment>
  );
}

export default WidgetBuilderGroupBySelector;
