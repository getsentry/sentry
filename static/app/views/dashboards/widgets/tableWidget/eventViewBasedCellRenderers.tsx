import {Fragment} from 'react';
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
import {TopResultsIndicator} from 'sentry/views/discover/table/topResultsIndicator';

// Dashboards only supports top 5 for now
const DEFAULT_NUM_TOP_EVENTS = 5;

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
  topResultsIndicators,
}: EventViewBasedCellProps) => {
  return function (
    column: TabularColumn,
    dataRow: TabularRow,
    rowIndex: number,
    columnIndex: number
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

    return (
      <Fragment key={`${rowIndex}-${columnIndex}:${column.name}`}>
        {topResultsIndicators &&
          columnIndex === 0 &&
          topResultsIndicators <= DEFAULT_NUM_TOP_EVENTS && (
            <TopResultsIndicator count={topResultsIndicators} index={rowIndex} />
          )}
        {cell}
      </Fragment>
    );
  };
};
