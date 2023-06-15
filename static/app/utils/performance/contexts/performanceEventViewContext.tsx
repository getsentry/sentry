import EventView, {ImmutableEventView} from 'sentry/utils/discover/eventView';

import {createDefinedContext} from './utils';

type UsePerformanceEventViewContext = {
  eventView: EventView;
};

const [
  PerformanceEventViewProvider,
  _usePerformanceEventView,
  PerformanceEventViewContext,
] = createDefinedContext<UsePerformanceEventViewContext>({
  name: 'PerformanceEventViewContext',
});

export {PerformanceEventViewProvider, PerformanceEventViewContext};

// Provides a readonly event view. Also omits anything that isn't currently
// read-only, although in the future we should switch the code in EventView
// instead. If you need mutability, use the mutable version.
export function usePerformanceEventView(): ImmutableEventView {
  return _usePerformanceEventView().eventView;
}

export function useMutablePerformanceEventView() {
  return usePerformanceEventView().clone();
}
