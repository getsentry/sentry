import type React from 'react';
import styled from '@emotion/styled';

import {space} from 'sentry/styles/space';

function ObjectView({obj}: {obj: object}) {
  if (Array.isArray(obj)) {
    return (
      <ListContainer>
        {obj.map((x, i) => (
          <li key={'array-' + i}>{renderGeneralSpanDetailsValue(x)}</li>
        ))}
      </ListContainer>
    );
  }
  return (
    <ObjectContainer>
      {Object.keys(obj).map(key => (
        <div key={key}>
          {key}: {renderGeneralSpanDetailsValue(obj[key])}
        </div>
      ))}
    </ObjectContainer>
  );
}

export function renderGeneralSpanDetailsValue(value: any): React.ReactNode {
  if (typeof value === 'string') {
    return value;
  }
  if (typeof value === 'object') {
    return <ObjectView obj={value} />;
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
