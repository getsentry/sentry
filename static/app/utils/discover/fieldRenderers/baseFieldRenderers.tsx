import {useTheme} from '@emotion/react';
import type {LocationDescriptor} from 'history';

import type {TableDataRow} from 'sentry/utils/discover/discoverQuery';
import type {EventData, MetaType} from 'sentry/utils/discover/eventView';
import type EventView from 'sentry/utils/discover/eventView';
import {getFieldRenderer} from 'sentry/utils/discover/fieldRenderers';
import {LINKED_FIELDS} from 'sentry/utils/discover/fieldRenderers/linkedFieldRenderers';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import useProjects from 'sentry/utils/useProjects';
import type {Actions} from 'sentry/views/discover/table/cellAction';
import CellAction from 'sentry/views/discover/table/cellAction';
import type {TableColumn} from 'sentry/views/discover/table/types';

type BaseFieldRendererProps = {
  column: TableColumn<keyof TableDataRow>;
  data: EventData;
  meta: MetaType;
  allowedActions?: Actions[];
  disableLazyLoad?: boolean;
  eventView?: EventView;
  onSelectAction?: (action: Actions, value: string | number) => void;
  // TODO: figure this cursed thing out
  unit?: string;
};

export function BaseFieldRenderer({
  column,
  data,
  meta,
  unit,
  allowedActions = [],
  onSelectAction,
  disableLazyLoad,
}: BaseFieldRendererProps) {
  const location = useLocation();
  const organization = useOrganization();
  const theme = useTheme();
  const {projects} = useProjects();

  const field = String(column.key);
  // const unit = meta?.unit[column.key];
  const baggage = {
    location,
    organization,
    theme,
    unit,
    disableLazyLoad,
    projects,
  };

  let cell: React.ReactNode;
  let target: LocationDescriptor | undefined;

  if (LINKED_FIELDS.hasOwnProperty(field)) {
    const result = LINKED_FIELDS[field]!.renderFunc(data, baggage);
    cell = result.node;
    target = result.target;
  } else {
    cell = getFieldRenderer(field, meta)(data, baggage);
  }

  return (
    <CellAction
      allowActions={allowedActions}
      column={column}
      dataRow={data as TableDataRow}
      handleCellAction={(action: Actions, value: string | number) => {
        onSelectAction?.(action, value);
      }}
      to={target}
    >
      {cell}
    </CellAction>
  );
}
