import {QueryFieldValue} from 'sentry/utils/discover/fields';
import {FieldValueKind} from 'sentry/views/eventsV2/table/types';

import {SESSIONS_TAGS} from '../../releaseWidget/fields';

import {GroupBySelector} from './groupBySelector';

interface Props {
  columns: QueryFieldValue[];
  onChange: (newFields: QueryFieldValue[]) => void;
}

export function ReleaseGroupBySelector({columns, onChange}: Props) {
  // Tags are sorted alphabetically to make it easier to find the correct option
  // and are converted to fieldOptions format
  const fieldOptions = Object.values(SESSIONS_TAGS)
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
