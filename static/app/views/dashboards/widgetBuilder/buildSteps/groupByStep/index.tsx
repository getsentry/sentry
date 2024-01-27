import {t} from 'sentry/locale';
import type {Organization, TagCollection} from 'sentry/types';
import type {QueryFieldValue} from 'sentry/utils/discover/fields';
import type {WidgetQuery} from 'sentry/views/dashboards/types';

import type {DataSet} from '../../utils';
import {useGroupByOptions} from '../../utils';
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
  queries,
}: Props) {
  const widgetType = DATA_SET_TO_WIDGET_TYPE[dataSet];
  const groupByOptions = useGroupByOptions(organization, tags, widgetType, queries);

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
