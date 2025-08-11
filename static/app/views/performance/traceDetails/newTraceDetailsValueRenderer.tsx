import styled from '@emotion/styled';

import {space} from 'sentry/styles/space';

function ObjectView({obj}: {obj: Record<string, unknown> | unknown[]}) {
  if (Array.isArray(obj)) {
    return (
      <ListContainer>
        {obj.map((x, i) => (
          <li key={'array-' + i}>
            <GeneralSpanDetailsValue value={x} />
          </li>
        ))}
      </ListContainer>
    );
  }
  return (
    <ObjectContainer>
      {Object.keys(obj).map(key => (
        <div key={key}>
          {key}: <GeneralSpanDetailsValue value={obj[key]} />
        </div>
      ))}
    </ObjectContainer>
  );
}

export function GeneralSpanDetailsValue({value}: {value: any}) {
  if (typeof value === 'string') {
    return <span>{value}</span>;
  }
  if (typeof value === 'object') {
    if (value === null) {
      return <span>null</span>;
    }
    return <ObjectView obj={value} />;
  }
  return <span>{JSON.stringify(value, null, 4)}</span>;
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
