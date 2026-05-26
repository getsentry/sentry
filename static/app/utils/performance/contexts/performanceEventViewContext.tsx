import {createContext} from 'react';

import type {EventView} from 'sentry/utils/discover/eventView';

type UsePerformanceEventViewContext = {
  eventView: EventView;
};

export const PerformanceEventViewContext = createContext<
  UsePerformanceEventViewContext | undefined
>(undefined);
