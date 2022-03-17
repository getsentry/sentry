import {t} from 'sentry/locale';
import {Organization, TagCollection} from 'sentry/types';
import {QueryFieldValue} from 'sentry/utils/discover/fields';
import Measurements from 'sentry/utils/measurements/measurements';
import {DisplayType, WidgetType} from 'sentry/views/dashboardsV2/types';

import {getAmendedFieldOptions} from '../../utils';
import {BuildStep} from '../buildStep';

import {YAxisSelector} from './yAxisSelector';

interface Props {
  aggregates: QueryFieldValue[];
  displayType: DisplayType;
  onYAxisChange: (newFields: QueryFieldValue[]) => void;
  organization: Organization;
  tags: TagCollection;
  widgetType: WidgetType;
  queryErrors?: Record<string, any>[];
}

export function YAxisStep({
  displayType,
  queryErrors,
  aggregates,
  onYAxisChange,
  organization,
  tags,
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
            aggregates={aggregates}
            fieldOptions={getAmendedFieldOptions({measurements, organization, tags})}
            onChange={onYAxisChange}
            errors={queryErrors}
          />
        )}
      </Measurements>
    </BuildStep>
  );
}
