import {t} from 'sentry/locale';
import {Organization, TagCollection} from 'sentry/types';
import {QueryFieldValue} from 'sentry/utils/discover/fields';
import Measurements from 'sentry/utils/measurements/measurements';
import {DisplayType, WidgetType} from 'sentry/views/dashboardsV2/types';

import {DataSet, getAmendedFieldOptions} from '../../utils';
import {BuildStep} from '../buildStep';

import {ReleaseYAxisSelector} from './releaseYAxisSelector';
import {YAxisSelector} from './yAxisSelector';

interface Props {
  aggregates: QueryFieldValue[];
  dataSet: DataSet;
  displayType: DisplayType;
  onYAxisChange: (newFields: QueryFieldValue[]) => void;
  organization: Organization;
  tags: TagCollection;
  widgetType: WidgetType;
  queryErrors?: Record<string, any>[];
}

export function YAxisStep({
  displayType,
  dataSet,
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
              "This is the data you'd be visualizing in the display. If the overlay units conflict, the charts will always base it off of the first line."
            )
          : t("This is the data you'd be visualizing in the display.")
      }
    >
      {dataSet === DataSet.RELEASES ? (
        <ReleaseYAxisSelector
          widgetType={widgetType}
          displayType={displayType}
          aggregates={aggregates}
          onChange={onYAxisChange}
          errors={queryErrors}
        />
      ) : (
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
      )}
    </BuildStep>
  );
}
