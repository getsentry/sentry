import {Fragment} from 'react';
import styled from '@emotion/styled';

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
      {Object.entries(otherContexts).map(([key, value]) => {
        if (key === 'response') {
          return (
            <ResponseChunk key="response">
              <Chunk
                type="response"
                alias="response"
                group={group}
                event={event}
                value={value}
              />
            </ResponseChunk>
          );
        }

        return (
          <Chunk
            key={key}
            type={value?.type ?? ''}
            alias={key}
            group={group}
            event={event}
            value={value}
          />
        );
      })}
    </Fragment>
  );
}

export default Contexts;

// HACK: Styling overrides to render Response headers as key-value pairs
const ResponseChunk = styled('div')`
  #response-headers > pre {
    padding: 0;
    margin-left: 10px;
    background: ${p => p.theme.background};
  }
`;
