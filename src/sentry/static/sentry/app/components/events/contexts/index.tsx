import React from 'react';

import {Group} from 'app/types';
import {Event} from 'app/types/event';
import {objectIsEmpty} from 'app/utils';

import Chunk from './chunk';

type Props = {
  event: Event;
  group?: Group;
};

function Contexts({event, group}: Props) {
  const {user, contexts} = event;

  return (
    <React.Fragment>
      {!objectIsEmpty(user) && (
        <Chunk
          key="user"
          type="user"
          alias="user"
          group={group}
          event={event}
          value={user}
        />
      )}
      {Object.entries(contexts).map(([key, value]) => (
        <Chunk
          key={key}
          type={value?.type ?? ''}
          alias={key}
          group={group}
          event={event}
          value={value}
        />
      ))}
    </React.Fragment>
  );
}

export default Contexts;
