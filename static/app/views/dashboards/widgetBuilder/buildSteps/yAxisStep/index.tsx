import {t} from 'sentry/locale';
import type {Organization, TagCollection} from 'sentry/types';
import type {QueryFieldValue} from 'sentry/utils/discover/fields';
import type {WidgetType} from 'sentry/views/dashboards/types';
import {DisplayType} from 'sentry/views/dashboards/types';

import type {DataSet} from '../../utils';
import {BuildStep} from '../buildStep';

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
  queryErrors,
  aggregates,
  onYAxisChange,
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
      <YAxisSelector
        widgetType={widgetType}
        displayType={displayType}
        aggregates={aggregates}
        onChange={onYAxisChange}
        tags={tags}
        errors={queryErrors}
      />
    </BuildStep>
  );
}
