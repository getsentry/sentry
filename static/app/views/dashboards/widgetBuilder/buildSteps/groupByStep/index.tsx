import {t} from 'sentry/locale';
import type {TagCollection} from 'sentry/types/group';
import type {Organization} from 'sentry/types/organization';
import type {QueryFieldValue} from 'sentry/utils/discover/fields';
import type {UseApiQueryResult} from 'sentry/utils/queryClient';
import type RequestError from 'sentry/utils/requestError/requestError';
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
  organization: Organization;
  tags: TagCollection;
  validatedWidgetResponse: UseApiQueryResult<ValidateWidgetResponse, RequestError>;
}

export function GroupByStep({
  dataSet,
  columns,
  onGroupByChange,
  organization,
  tags,
  validatedWidgetResponse,
}: Props) {
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
      />
    </BuildStep>
  );
}
