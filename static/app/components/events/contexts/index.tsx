import {Fragment} from 'react';

import {Group} from 'sentry/types';
import {Event} from 'sentry/types/event';
import {objectIsEmpty} from 'sentry/utils';

import Chunk from './chunk';

type Props = {
  event: Event;
  group?: Group;
};

function Contexts({event, group}: Props) {
  const {user, contexts} = event;

  const {feedback, ...otherContexts} = contexts;

  // Temporarily define OpenTelemetry context as a special case
  // since we want to this to apply to events that were ingested with old Relays that did not
  // define the OpenTelemetry context in the schema.
  //
  // TODO(abhi): Revert this after 90 days when Relay has been deployed
  // to all customers.
  if (otherContexts.otel) {
    otherContexts.otel.type = 'otel';
  }

  return (
    <Fragment>
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

export default Contexts;
