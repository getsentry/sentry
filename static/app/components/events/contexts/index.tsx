import {Fragment, useCallback, useEffect} from 'react';
import * as Sentry from '@sentry/react';

import ContextCard from 'sentry/components/events/contexts/contextCard';
import ContextDataSection from 'sentry/components/events/contexts/contextDataSection';
import {useHasNewTagsUI} from 'sentry/components/events/eventTags/util';
import type {Group} from 'sentry/types';
import type {Event} from 'sentry/types/event';
import {objectIsEmpty} from 'sentry/utils';
import useProjects from 'sentry/utils/useProjects';

import {Chunk} from './chunk';

type Props = {
  event: Event;
  group?: Group;
};

export function EventContexts({event, group}: Props) {
  const hasNewTagsUI = useHasNewTagsUI();
  const {projects} = useProjects();
  const project = projects.find(p => p.id === event.projectID);
  const {user, contexts, sdk} = event;

  const {feedback, response, ...otherContexts} = contexts ?? {};

  const usingOtel = useCallback(
    () => otherContexts.otel !== undefined,
    [otherContexts.otel]
  );

  useEffect(() => {
    const transaction = Sentry.getActiveTransaction();
    if (transaction && usingOtel()) {
      transaction.tags.otel_event = true;
      transaction.tags.otel_sdk = sdk?.name;
      transaction.tags.otel_sdk_version = sdk?.version;
    }
  }, [usingOtel, sdk]);

  if (hasNewTagsUI) {
    const orderedContext: [string, any][] = [
      ['response', response],
      ['feedback', feedback],
      ['user', user],
      ...Object.entries(otherContexts),
    ];
    // For these context keys, use 'key' as 'type' rather than 'value.type'
    const overrideTypes = new Set(['response', 'feedback', 'user']);
    const cards = orderedContext
      .filter(([_k, v]) => {
        const contextKeys = Object.keys(v ?? {});
        const isInvalid =
          // Empty context
          contextKeys.length === 0 ||
          // Empty aside from 'type' key
          (contextKeys.length === 1 && contextKeys[0] === 'type');
        return !isInvalid;
      })
      .map(([k, v]) => (
        <ContextCard
          key={k}
          type={overrideTypes.has(k) ? k : v?.type ?? ''}
          alias={k}
          value={v}
          event={event}
          group={group}
          project={project}
        />
      ));

    return <ContextDataSection cards={cards} />;
  }

  return (
    <Fragment>
      {!objectIsEmpty(response) && (
        <Chunk
          key="response"
          type="response"
          alias="response"
          group={group}
          event={event}
          value={response}
        />
      )}
      {!objectIsEmpty(feedback) && (
        <Chunk
          key="feedback"
          type="feedback"
          alias="feedback"
          group={group}
          event={event}
          value={feedback}
        />
      )}
      {user && !objectIsEmpty(user) && (
        <Chunk
          key="user"
          type="user"
          alias="user"
          group={group}
          event={event}
          value={user}
        />
      )}
      {Object.entries(otherContexts).map(([key, value]) => (
        <Chunk
          key={key}
          type={value?.type ?? ''}
          alias={key}
          group={group}
          event={event}
          value={value}
        />
      ))}
    </Fragment>
  );
}
