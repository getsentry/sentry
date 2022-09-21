import {Fragment} from 'react';

import {Group} from 'sentry/types';
import {Event} from 'sentry/types/event';
import {objectIsEmpty} from 'sentry/utils';

import Chunk from './chunk';

type Props = {
  event: Event;
  groupId?: string;
  groupPluginContexts?: Group['pluginContexts'];
};

function Contexts({event, groupId, groupPluginContexts}: Props) {
  const {user, contexts} = event;

  return (
    <Fragment>
      {user && !objectIsEmpty(user) && (
        <Chunk
          key="user"
          type="user"
          alias="user"
          groupId={groupId}
          groupPluginContexts={groupPluginContexts}
          event={event}
          value={user}
        />
      )}
      {Object.entries(contexts).map(([key, value]) => (
        <Chunk
          key={key}
          type={value?.type ?? ''}
          alias={key}
          groupId={groupId}
          groupPluginContexts={groupPluginContexts}
          event={event}
          value={value}
        />
      ))}
    </Fragment>
  );
}

export default Contexts;
