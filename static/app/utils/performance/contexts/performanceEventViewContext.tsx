import EventView, {ImmutableEventView} from 'app/utils/discover/eventView';

import {createDefinedContext} from './utils';

type usePerformanceEventViewContext = {
  eventView: EventView;
};

const [PerformanceEventViewProvider, _usePerformanceEventView] =
  createDefinedContext<usePerformanceEventViewContext>({
    name: 'PerformanceEventViewContext',
  });

// Provides a readonly event view. Also omits anything that isn't currently read-only, although in the future we should switch the code in EventView instead.
// If you need mutability, use the mutable version.
const usePerformanceEventView: () => ImmutableEventView = () =>
  _usePerformanceEventView().eventView;
export {PerformanceEventViewProvider, usePerformanceEventView};

export function useMutablePerformanceEventView() {
  return usePerformanceEventView().clone();
}
