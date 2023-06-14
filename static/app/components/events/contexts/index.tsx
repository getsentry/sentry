import {Fragment, useCallback, useEffect} from 'react';
import * as Sentry from '@sentry/react';

import {Group} from 'sentry/types';
import {Event} from 'sentry/types/event';
import {objectIsEmpty} from 'sentry/utils';

import {Chunk} from './chunk';

type Props = {
  event: Event;
  group?: Group;
};

export function EventContexts({event, group}: Props) {
  const {user, contexts, sdk} = event;

  const {feedback, response, ...otherContexts} = contexts ?? {};

  const usingOtel = useCallback(
    () => otherContexts.otel !== undefined,
    [otherContexts.otel]
  );

  useEffect(() => {
    const transaction = Sentry.getCurrentHub().getScope()?.getTransaction();
    if (transaction && usingOtel()) {
      transaction.tags.otel_event = true;
      transaction.tags.otel_sdk = sdk?.name;
      transaction.tags.otel_sdk_version = sdk?.version;
    }
  }, [usingOtel, sdk]);

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
