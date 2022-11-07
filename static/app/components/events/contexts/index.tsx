import {Fragment} from 'react';
import styled from '@emotion/styled';

import {t} from 'sentry/locale';
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

  console.log(contexts);
  const {feedback, response, ...otherContexts} = contexts;

  return (
    <Fragment>
      {response && !objectIsEmpty(response) && (
        <ResponseChunk>
          <Chunk
            key="response"
            type="response"
            alias="response"
            group={group}
            event={event}
            value={response}
          />
        </ResponseChunk>
      )}
      {/* {!objectIsEmpty(feedback) && (
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
      ))} */}
    </Fragment>
  );
}

export default Contexts;

const ResponseChunk = styled('div')`
  border: 1px solid red;
`;
