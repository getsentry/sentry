import {t} from 'sentry/locale';
import {Organization, SessionsMeta, TagCollection} from 'sentry/types';
import {QueryFieldValue} from 'sentry/utils/discover/fields';
import Measurements from 'sentry/utils/measurements/measurements';

import {
  generateReleaseWidgetFieldOptions,
  SESSIONS_TAGS,
} from '../../releaseWidget/fields';
import {DataSet, getAmendedFieldOptions} from '../../utils';
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
  return (
    <BuildStep
      title={t('Group your results')}
      description={t('This is how you can group your data result by field or tag.')}
    >
      {dataSet === DataSet.RELEASES ? (
        <GroupBySelector
          columns={columns}
          fieldOptions={generateReleaseWidgetFieldOptions(
            [] as SessionsMeta[],
            SESSIONS_TAGS
          )}
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
