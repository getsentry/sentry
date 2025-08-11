import type EventView from 'sentry/utils/discover/eventView';

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
