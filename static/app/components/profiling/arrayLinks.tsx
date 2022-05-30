import {useState} from 'react';
import {Link} from 'react-router';
import styled from '@emotion/styled';
import {LocationDescriptor} from 'history';

import {t} from 'sentry/locale';
import overflowEllipsis from 'sentry/styles/overflowEllipsis';
import space from 'sentry/styles/space';

type Item = {
  target: LocationDescriptor;
  value: string;
};

interface ArrayLinksProps {
  items: Item[];
}

function ArrayLinks({items}: ArrayLinksProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <ArrayContainer expanded={expanded}>
      {items.length > 0 && <LinkedItem item={items[0]} />}
      {items.length > 1 &&
        expanded &&
        items
          .slice(1, items.length)
          .map(item => <LinkedItem key={item.value} item={item} />)}
      {items.length > 1 ? (
        <ButtonContainer>
          <button onClick={() => setExpanded(!expanded)}>
            {expanded ? t('[collapse]') : t('[+%s more]', items.length - 1)}
          </button>
        </ButtonContainer>
      ) : null}
    </ArrayContainer>
  );
}

function LinkedItem({item}: {item: Item}) {
  return (
    <ArrayItem>
      <Link to={item.target}>{item.value}</Link>
    </ArrayItem>
  );
}

const ArrayContainer = styled('div')<{expanded: boolean}>`
  display: flex;
  flex-direction: ${p => (p.expanded ? 'column' : 'row')};
`;

const ArrayItem = styled('span')`
  flex-shrink: 1;
  display: block;

  ${overflowEllipsis};
  width: unset;
`;

const ButtonContainer = styled('div')`
  white-space: nowrap;

  & button {
    background: none;
    border: 0;
    outline: none;
    padding: 0;
    cursor: pointer;
    color: ${p => p.theme.blue300};
    margin-left: ${space(0.5)};
  }
`;

export {ArrayLinks};
