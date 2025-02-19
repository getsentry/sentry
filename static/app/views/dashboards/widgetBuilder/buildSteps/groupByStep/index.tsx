import {t} from 'sentry/locale';
import type {TagCollection} from 'sentry/types/group';
import type {QueryFieldValue} from 'sentry/utils/discover/fields';
import type {UseApiQueryResult} from 'sentry/utils/queryClient';
import type RequestError from 'sentry/utils/requestError/requestError';
import useOrganization from 'sentry/utils/useOrganization';
import {getDatasetConfig} from 'sentry/views/dashboards/datasetConfig/base';
import type {ValidateWidgetResponse} from 'sentry/views/dashboards/types';

import type {DataSet} from '../../utils';
import {DATA_SET_TO_WIDGET_TYPE} from '../../widgetBuilder';
import {BuildStep} from '../buildStep';

import {GroupBySelector} from './groupBySelector';

interface Props {
  columns: QueryFieldValue[];
  dataSet: DataSet;
  onGroupByChange: (newFields: QueryFieldValue[]) => void;
  tags: TagCollection;
  validatedWidgetResponse: UseApiQueryResult<ValidateWidgetResponse, RequestError>;
}

export function GroupByStep({
  dataSet,
  columns,
  onGroupByChange,
  tags,
  validatedWidgetResponse,
}: Props) {
  const organization = useOrganization();
  const datasetConfig = getDatasetConfig(DATA_SET_TO_WIDGET_TYPE[dataSet]);

  const groupByOptions = datasetConfig.getGroupByFieldOptions
    ? datasetConfig.getGroupByFieldOptions(organization, tags)
    : {};

  return (
    <BuildStep
      title={t('Group your results')}
      description={t('This is how you can group your data result by field or tag.')}
    >
      <GroupBySelector
        columns={columns}
        fieldOptions={groupByOptions}
        onChange={onGroupByChange}
        validatedWidgetResponse={validatedWidgetResponse}
        widgetType={DATA_SET_TO_WIDGET_TYPE[dataSet]}
      />
    </BuildStep>
  );
}
