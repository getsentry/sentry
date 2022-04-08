import {QueryFieldValue} from 'sentry/utils/discover/fields';
import {useMetricsContext} from 'sentry/utils/useMetricsContext';
import {FieldValueKind} from 'sentry/views/eventsV2/table/types';

import {GroupBySelector} from './groupBySelector';

interface Props {
  columns: QueryFieldValue[];
  onChange: (newFields: QueryFieldValue[]) => void;
}

export function ReleaseGroupBySelector({columns, onChange}: Props) {
  const {tags} = useMetricsContext();

  // Tags are sorted alphabetically to make it easier to find the correct option
  // and are converted to fieldOptions format
  const fieldOptions = Object.values(tags)
    .map(({key}) => key)
    .sort((a, b) => a.localeCompare(b))
    .reduce((acc, tagKey) => {
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
