import type React from 'react';
import styled from '@emotion/styled';

import {space} from 'sentry/styles/space';

function renderObject(obj: object): React.ReactNode {
  if (Array.isArray(obj)) {
    return (
      <ListContainer>
        {obj.map((x, i) => (
          <li key={'array-' + i}>{renderSpanDetailsValue(x)}</li>
        ))}
      </ListContainer>
    );
  }
  return (
    <ObjectContainer>
      {Object.keys(obj).map(key => (
        <div key={key}>
          {key}: {renderSpanDetailsValue(obj[key])}
        </div>
      ))}
    </ObjectContainer>
  );
}

export function renderSpanDetailsValue(value: any): React.ReactNode {
  if (typeof value === 'string') {
    return value;
  }
  if (typeof value === 'object') {
    return renderObject(value);
  }
  return JSON.stringify(value, null, 4);
}

const ListContainer = styled('ul')`
  display: flex;
  flex-direction: column;
  gap: ${space(1)};
  padding: 0;
  margin-left: ${space(1)};
  list-style-type: '-';
  flex-grow: 1;
  flex-basis: full;
`;

const ObjectContainer = styled('div')`
  display: flex;
  flex-direction: column;
  gap: ${space(1)};
  margin-left: ${space(1)};
  flex-grow: 1;
  flex-basis: full;
`;
