import {useEffect} from 'react';

import localStorage from 'sentry/utils/localStorage';
import type {DomainView} from 'sentry/views/insights/pages/useFilters';
import {domainViews, useDomainViewFilters} from 'sentry/views/insights/pages/useFilters';

const STORAGE_KEY = 'insights-domain-redirect';

export function useRegisterDomainViewUsage() {
  const {view} = useDomainViewFilters();
  useEffect(() => {
    if (view) {
      localStorage.setItem(STORAGE_KEY, view);
    }
  }, [view]);
}

function isDomainView(value: unknown): value is DomainView {
  return domainViews.includes(value as DomainView);
}

export function getLastUsedDomainView(): DomainView {
  const storedValue = localStorage.getItem(STORAGE_KEY);

  if (isDomainView(storedValue)) {
    return storedValue;
  }

  return 'frontend';
}
