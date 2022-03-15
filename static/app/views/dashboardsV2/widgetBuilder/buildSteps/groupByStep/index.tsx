import {t} from 'sentry/locale';
import {explodeField, QueryFieldValue} from 'sentry/utils/discover/fields';
import Measurements, {
  MeasurementCollection,
} from 'sentry/utils/measurements/measurements';
import {WidgetQuery} from 'sentry/views/dashboardsV2/types';
import {generateFieldOptions} from 'sentry/views/eventsV2/utils';

import {BuildStep} from '../buildStep';

import {GroupBySelector} from './groupBySelector';

interface Props {
  onChange: (fields: QueryFieldValue[]) => void;
  onGetAmendedFieldOptions: (
    measurements: MeasurementCollection
  ) => ReturnType<typeof generateFieldOptions>;
  queries: WidgetQuery[];
}

export function GroupByStep({queries, onGetAmendedFieldOptions, onChange}: Props) {
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
            columns={
              queries[0].columns
                ?.filter(field => !(field === 'equation|'))
                .map(field => explodeField({field})) ?? []
            }
            fieldOptions={onGetAmendedFieldOptions(measurements)}
            onChange={onChange}
          />
        )}
      </Measurements>
    </BuildStep>
  );
}
