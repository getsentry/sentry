import {Fragment} from 'react';
import partition from 'lodash/partition';

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

  const [feedbackContextKey, otherContextKeys] = partition(
    Object.keys(contexts),
    key => key === 'feedback'
  );

  return (
    <Fragment>
      {!!feedbackContextKey.length && (
        <Chunk
          key="feedback"
          type="feedback"
          alias="feedback"
          group={group}
          event={event}
          value={contexts[feedbackContextKey[0]]}
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
      {otherContextKeys.map(key => (
        <Chunk
          key={key}
          type={contexts[feedbackContextKey[key]]?.type ?? ''}
          alias={key}
          group={group}
          event={event}
          value={contexts[feedbackContextKey[key]]}
        />
      ))}
    </Fragment>
  );
}

export default Contexts;
