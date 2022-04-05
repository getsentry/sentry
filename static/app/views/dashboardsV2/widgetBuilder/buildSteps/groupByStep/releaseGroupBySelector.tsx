import {QueryFieldValue} from 'sentry/utils/discover/fields';
import {useMetricTags} from 'sentry/utils/useMetricTags';
import {FieldValueKind} from 'sentry/views/eventsV2/table/types';

import {GroupBySelector} from './groupBySelector';

interface Props {
  columns: QueryFieldValue[];
  onChange: (newFields: QueryFieldValue[]) => void;
}

export function ReleaseGroupBySelector({columns, onChange}: Props) {
  const {metricTags} = useMetricTags();

  const tagKeys = Object.values(metricTags)
    .map(({key}) => key)
    .sort((a, b) => a.localeCompare(b));

  const fieldOptions = tagKeys.reduce((acc, tagKey) => {
    acc[`tag:${tagKey}`] = {
      label: tagKey,
      value: {
        kind: FieldValueKind.TAG,
        meta: {name: tagKey, dataType: 'string'},
      },
    };
    return acc;
  }, {});

  return (
    <GroupBySelector columns={columns} fieldOptions={fieldOptions} onChange={onChange} />
  );
}
