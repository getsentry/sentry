import {t} from 'sentry/locale';
import {Organization, TagCollection} from 'sentry/types';
import {QueryFieldValue} from 'sentry/utils/discover/fields';
import Measurements from 'sentry/utils/measurements/measurements';
import {FieldValueKind} from 'sentry/views/eventsV2/table/types';

import {SESSIONS_TAGS} from '../../releaseWidget/fields';
import {DataSet, getAmendedFieldOptions} from '../../utils';
import {BuildStep} from '../buildStep';

import {GroupBySelector} from './groupBySelector';

// Tags are sorted alphabetically to make it easier to find the correct option
// and are converted to fieldOptions format
const releaseFieldOptions = Object.values(SESSIONS_TAGS)
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
  return (
    <BuildStep
      title={t('Group your results')}
      description={t('This is how you can group your data result by field or tag.')}
    >
      {dataSet === DataSet.RELEASES ? (
        <GroupBySelector
          columns={columns}
          fieldOptions={releaseFieldOptions}
          onChange={onGroupByChange}
        />
      ) : (
        <Measurements>
          {({measurements}) => (
            <GroupBySelector
              columns={columns}
              fieldOptions={getAmendedFieldOptions({
                measurements,
                tags,
                organization,
              })}
              onChange={onGroupByChange}
            />
          )}
        </Measurements>
      )}
    </BuildStep>
  );
}
