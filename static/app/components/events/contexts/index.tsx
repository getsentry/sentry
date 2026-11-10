import {useCallback, useEffect} from 'react';
import * as Sentry from '@sentry/react';

import type {Event} from 'sentry/types/event';
import {useProjects} from 'sentry/utils/useProjects';

import {ContextDataSection} from './contextDataSection';

type Props = {
  event: Event;
  disableCollapsePersistence?: boolean;
};

export function EventContexts({event, disableCollapsePersistence}: Props) {
  const {projects} = useProjects();
  const project = projects.find(p => p.id === event.projectID);
  const {contexts, sdk} = event;

  const usingOtel = useCallback(() => contexts.otel !== undefined, [contexts.otel]);

  useEffect(() => {
    const span = Sentry.getActiveSpan();
    if (usingOtel() && span) {
      const rootSpan = Sentry.getRootSpan(span);
      rootSpan.setAttribute('otel_event', true);
      rootSpan.setAttribute('otel_sdk', sdk?.name ?? undefined);
      rootSpan.setAttribute('otel_sdk_version', sdk?.version ?? undefined);
    }
  }, [usingOtel, sdk]);

  return (
    <ContextDataSection
      event={event}
      project={project}
      disableCollapsePersistence={disableCollapsePersistence}
    />
  );
}
