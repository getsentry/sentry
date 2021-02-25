import {Event} from 'app/types/event';
import {
  DiscoverQueryProps,
  GenericChildrenProps,
} from 'app/utils/discover/genericDiscoverQuery';

export type EventLite = {
  event_id: string;
  generation: number | null;
  span_id: string;
  transaction: string;
  'transaction.duration': number;
  project_id: number;
  project_slug: string;
  parent_event_id: string | null;
  parent_span_id: string | null;
  is_root: boolean;
};

export type TraceLite = EventLite[];

export type TraceFull = EventLite & {
  children: TraceFull[];
};

export type TraceProps = {
  event: Event;
};

export type TraceLiteQueryChildrenProps = Omit<
  GenericChildrenProps<TraceProps>,
  'tableData' | 'pageLinks'
> & {
  trace: TraceLite | null;
};

export type TraceFullQueryChildrenProps = Omit<
  GenericChildrenProps<TraceProps>,
  'tableData' | 'pageLinks'
> & {
  trace: TraceFull | null;
};

export type RequestProps = DiscoverQueryProps & TraceProps;
