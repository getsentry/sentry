import {t} from 'sentry/locale';
import {QueryFieldValue} from 'sentry/utils/discover/fields';
import Measurements, {
  MeasurementCollection,
} from 'sentry/utils/measurements/measurements';
import {generateFieldOptions} from 'sentry/views/eventsV2/utils';

import {BuildStep} from '../buildStep';

import {GroupBySelector} from './groupBySelector';

interface Props {
  columns: QueryFieldValue[];
  onGetAmendedFieldOptions: (
    measurements: MeasurementCollection
  ) => ReturnType<typeof generateFieldOptions>;
  onGroupByChange: (newFields: QueryFieldValue[]) => void;
}

export function GroupByStep({columns, onGroupByChange, onGetAmendedFieldOptions}: Props) {
  return (
    <BuildStep
      title={t('Group your results')}
      description={t(
        'This is how you can group your data result by tag or field. For a full list, read the docs.'
      )}
    >
      <Measurements>
        {({measurements}) => (
          <GroupBySelector
            columns={columns}
            fieldOptions={onGetAmendedFieldOptions(measurements)}
            onChange={onGroupByChange}
          />
        )}
      </Measurements>
    </BuildStep>
  );
}
