import type {Theme} from '@emotion/react';
import type {Location} from 'history';

import type {Organization} from 'sentry/types/organization';
import type EventView from 'sentry/utils/discover/eventView';
import type {MetaType} from 'sentry/utils/discover/eventView';
import type {getFieldRenderer} from 'sentry/utils/discover/fieldRenderers';
import type {
  TabularColumn,
  TabularData,
  TabularRow,
} from 'sentry/views/dashboards/widgets/common/types';

interface EventViewBasedCellProps {
  eventView: EventView;
  getCustomFieldRenderer: (
    field: string,
    meta: MetaType,
    organization?: Organization
  ) => ReturnType<typeof getFieldRenderer> | null;
  location?: Location;
  organization?: Organization;
  tableData?: TabularData;
  theme?: Theme;
  topResultsIndicators?: number;
}

export const renderEventViewBasedBodyCell = ({
  tableData,
  organization,
  eventView,
  theme,
  getCustomFieldRenderer,
  location,
}: EventViewBasedCellProps) => {
  return function (
    column: TabularColumn,
    dataRow: TabularRow,
    _rowIndex: number,
    _columnIndex: number
  ): React.ReactNode {
    if (!tableData?.meta || !location || !organization || !theme) {
      return undefined;
    }
    const tableMeta = tableData.meta;
    const unit = tableMeta.units?.[column.key] as string | undefined;
    const cell = getCustomFieldRenderer(
      column.key,
      tableMeta.fields,
      organization
    )?.(dataRow, {
      organization,
      location,
      eventView,
      unit,
      theme,
    });
    if (!cell) return undefined;

    return cell;
  };
};
