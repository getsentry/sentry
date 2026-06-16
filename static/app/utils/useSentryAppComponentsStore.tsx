import {useEffect, useMemo, useState} from 'react';

import {SentryAppComponentsStore} from 'sentry/stores/sentryAppComponentsStore';
import type {
  SentryAppComponent,
  SentryAppSchemaElement,
  SentryAppSchemaStacktraceLink,
} from 'sentry/types/integrations';

export function useSentryAppComponentsStore<
  Schema extends SentryAppSchemaStacktraceLink | SentryAppSchemaElement =
    | SentryAppSchemaStacktraceLink
    | SentryAppSchemaElement,
>({
  componentType,
}: {
  componentType: undefined | SentryAppComponent['type'];
}): Array<SentryAppComponent<Schema>> {
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

  return filteredComponents as Array<SentryAppComponent<Schema>>;
}
