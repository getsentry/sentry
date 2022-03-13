import {t} from 'sentry/locale';
import {QueryFieldValue} from 'sentry/utils/discover/fields';
import Measurements, {
  MeasurementCollection,
} from 'sentry/utils/measurements/measurements';
import {WidgetType} from 'sentry/views/dashboardsV2/types';
import {generateFieldOptions} from 'sentry/views/eventsV2/utils';

import {DisplayType} from '../../utils';
import {BuildStep} from '../buildStep';

import {YAxisSelector} from './yAxisSelector';

interface Props {
  displayType: DisplayType;
  explodedFields: QueryFieldValue[];
  onGetAmendedFieldOptions: (
    measurements: MeasurementCollection
  ) => ReturnType<typeof generateFieldOptions>;
  onYAxisOrColumnFieldChange: (newFields: QueryFieldValue[]) => void;
  widgetType: WidgetType;
  queryErrors?: Record<string, any>[];
}

export function YAxisStep({
  displayType,
  queryErrors,
  explodedFields,
  onYAxisOrColumnFieldChange,
  onGetAmendedFieldOptions,
  widgetType,
}: Props) {
  return (
    <BuildStep
      title={
        displayType === DisplayType.BIG_NUMBER
          ? t('Choose what to plot')
          : t('Choose what to plot in the y-axis')
      }
      description={
        [DisplayType.AREA, DisplayType.BAR, DisplayType.LINE].includes(displayType)
          ? t(
              "This is the data you'd be visualizing in the display. You can chart multiple overlays if they share a similar unit."
            )
          : t("This is the data you'd be visualizing in the display.")
      }
    >
      <Measurements>
        {({measurements}) => (
          <YAxisSelector
            widgetType={widgetType}
            displayType={displayType}
            fields={explodedFields}
            fieldOptions={onGetAmendedFieldOptions(measurements)}
            onChange={onYAxisOrColumnFieldChange}
            errors={queryErrors}
          />
        )}
      </Measurements>
    </BuildStep>
  );
}
