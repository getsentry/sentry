import {type Theme, useTheme} from '@emotion/react';
import type {Location, LocationDescriptor} from 'history';

import type {Organization} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';
import type {TableDataRow} from 'sentry/utils/discover/discoverQuery';
import type {EventData, MetaType} from 'sentry/utils/discover/eventView';
import type EventView from 'sentry/utils/discover/eventView';
import {getFieldRenderer} from 'sentry/utils/discover/fieldRenderers';
import {SPECIAL_FIELDS} from 'sentry/utils/discover/fieldRenderers/specialFieldRenderers';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import useProjects from 'sentry/utils/useProjects';
import type {Actions} from 'sentry/views/discover/table/cellAction';
import CellAction from 'sentry/views/discover/table/cellAction';
import type {TableColumn} from 'sentry/views/discover/table/types';

/**
 * Types, functions and definitions for rendering fields in discover results.
 */
export type RenderFunctionBaggageV2 = {
  location: Location;
  organization: Organization;
  projects: Project[];
  theme: Theme;
  /**
   * If true, all fields that are not needed immediately will not be rendered lazily.
   * This is useful for fields that require api calls or other side effects to render.
   *
   * eg. the code path field in logs requires a call to the stacktrace link api to render.
   */
  disableLazyLoad?: boolean;
  unit?: string;
};

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

  if (SPECIAL_FIELDS.hasOwnProperty(field)) {
    const result = SPECIAL_FIELDS[field]!.renderFunc(data, baggage);
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
