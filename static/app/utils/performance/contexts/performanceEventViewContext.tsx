import {createContext} from 'react';

import type {EventView} from 'sentry/utils/discover/eventView';

type UsePerformanceEventViewContext = {
  eventView: EventView;
};

const PerformanceEventViewContext = createContext<
  UsePerformanceEventViewContext | undefined
>(undefined);
PerformanceEventViewContext.displayName = 'PerformanceEventViewContext';

const PerformanceEventViewProvider = PerformanceEventViewContext.Provider;

export {PerformanceEventViewProvider, PerformanceEventViewContext};
