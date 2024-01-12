import {useEffect, useMemo, useState} from 'react';

import SentryAppComponentsStore from 'sentry/stores/sentryAppComponentsStore';
import type {SentryAppComponent} from 'sentry/types';

export default function useSentryAppComponentsStore({
  componentType,
}: {
  componentType: undefined | SentryAppComponent['type'];
}) {
  const [components, setComponents] = useState(SentryAppComponentsStore.getAll());

  useEffect(() => {
    const unsubscribe = SentryAppComponentsStore.listen(
      () => setComponents(SentryAppComponentsStore.getAll()),
      undefined
    );

    return unsubscribe as () => void;
  }, []);

  const filteredComponents = useMemo(() => {
    if (componentType) {
      return components.filter(item => item.type === componentType);
    }
    return components;
  }, [components, componentType]);

  return filteredComponents;
}
