import {useCallback, useEffect} from 'react';
import * as Sentry from '@sentry/react';

import ContextDataSection from 'sentry/components/events/contexts/contextDataSection';
import type {Event, EventContexts as EventContextValues} from 'sentry/types/event';
import type {Group} from 'sentry/types/group';
import useProjects from 'sentry/utils/useProjects';

type Props = {
  event: Event;
  group?: Group;
};

interface UnknownContextValue {
  [key: string]: any;
  type: 'default';
}

/**
 * Catch-all for context values, known and unknown
 */
export type ContextValue =
  | EventContextValues[keyof EventContextValues]
  | UnknownContextValue;

export interface ContextItem {
  alias: string;
  type: string;
  value: ContextValue;
}

export function getOrderedContextItems(event: Event): ContextItem[] {
  const {user, contexts} = event;
  const {data: customUserData, ...userContext} = user ?? {};

  // hide `flags` in the contexts section since we display this
  // info in the feature flag section below
  const {feedback, response, flags: _, ...otherContexts} = contexts ?? {};
  const orderedContext: [ContextItem['alias'], ContextValue][] = [
    ['response', response],
    ['feedback', feedback],
    ['user', {...userContext, ...(customUserData as any)}],
    ...Object.entries(otherContexts),
  ];
  // For these context aliases, use the alias as 'type' rather than 'value.type'
  const overrideTypesWithAliases = new Set([
    'response',
    'feedback',
    'user',
    'profile',
    'replay',
  ]);

  const items = orderedContext
    .filter(([_k, ctxValue]) => {
      const contextKeys = Object.keys(ctxValue ?? {});
      const isInvalid =
        // Empty context
        contextKeys.length === 0 ||
        // Empty aside from 'type' key
        (contextKeys.length === 1 && contextKeys[0] === 'type');
      return !isInvalid;
    })
    .map<ContextItem>(([alias, ctx]) => ({
      alias,
      type: overrideTypesWithAliases.has(alias) ? alias : ctx?.type,
      value: ctx,
    }));

  return items;
}

export function EventContexts({event, group}: Props) {
  const {projects} = useProjects();
  const project = projects.find(p => p.id === event.projectID);
  const {contexts, sdk} = event;

  const usingOtel = useCallback(() => contexts.otel !== undefined, [contexts.otel]);

  useEffect(() => {
    const span = Sentry.getActiveSpan();
    if (usingOtel() && span) {
      const rootSpan = Sentry.getRootSpan(span);
      rootSpan.setAttribute('otel_event', true);
      rootSpan.setAttribute('otel_sdk', sdk?.name);
      rootSpan.setAttribute('otel_sdk_version', sdk?.version);
    }
  }, [usingOtel, sdk]);

  return <ContextDataSection event={event} group={group} project={project} />;
}
