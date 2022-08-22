import {createContext} from 'react';

import {MetricsMetaCollection, MetricsTagCollection} from 'sentry/types';

export interface MetricsContextValue {
  metas: MetricsMetaCollection;
  tags: MetricsTagCollection;
}

export const MetricsContext = createContext<MetricsContextValue | undefined>(undefined);
