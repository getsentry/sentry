import {t} from 'sentry/locale';
import {Organization, TagCollection} from 'sentry/types';
import {QueryFieldValue} from 'sentry/utils/discover/fields';
import {getDatasetConfig} from 'sentry/views/dashboardsV2/datasetConfig/base';

import {DataSet} from '../../utils';
import {DATA_SET_TO_WIDGET_TYPE} from '../../widgetBuilder';
import {BuildStep} from '../buildStep';

import {GroupBySelector} from './groupBySelector';

interface Props {
  columns: QueryFieldValue[];
  dataSet: DataSet;
  onGroupByChange: (newFields: QueryFieldValue[]) => void;
  organization: Organization;
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
  return (
    <BuildStep
      title={t('Group your results')}
      description={t('This is how you can group your data result by field or tag.')}
    >
      <GroupBySelector
        columns={columns}
        fieldOptions={datasetConfig.getGroupByFieldOptions!(organization, tags)}
        onChange={onGroupByChange}
      />
    </BuildStep>
  );
}
