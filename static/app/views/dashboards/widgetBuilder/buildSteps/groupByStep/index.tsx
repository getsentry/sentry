import {t} from 'sentry/locale';
import type {Organization, TagCollection} from 'sentry/types';
import type {QueryFieldValue} from 'sentry/utils/discover/fields';
import {getDatasetConfig} from 'sentry/views/dashboards/datasetConfig/base';
import type {WidgetQuery} from 'sentry/views/dashboards/types';

import type {DataSet} from '../../utils';
import {DATA_SET_TO_WIDGET_TYPE} from '../../widgetBuilder';
import {BuildStep} from '../buildStep';

import {GroupBySelector} from './groupBySelector';

interface Props {
  columns: QueryFieldValue[];
  dataSet: DataSet;
  onGroupByChange: (newFields: QueryFieldValue[]) => void;
  organization: Organization;
  queries: WidgetQuery[];
  tags: TagCollection;
}

export function GroupByStep({
  dataSet,
  columns,
  onGroupByChange,
  organization,
  tags,
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
      />
    </BuildStep>
  );
}
