import {useState} from 'react';
import styled from '@emotion/styled';

import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';

import {nullableValue} from './fieldRenderers';

type Props = {
  value: (string | null)[];
};

function ArrayValue(props: Props) {
  const [expanded, setExpanded] = useState<boolean>(false);
  const {value} = props;

  const handleToggle = () => {
    setExpanded(!expanded);
  };

  return (
    <ArrayContainer expanded={expanded}>
      {expanded &&
        value
          .slice(0, value.length - 1)
          .map((item, i) => (
            <ArrayItem key={`${i}:${item}`}>{nullableValue(item)}</ArrayItem>
          ))}
      <ArrayItem>{nullableValue(value.slice(-1)[0]!)}</ArrayItem>
      {value.length > 1 ? (
        <ButtonContainer>
          <button onClick={handleToggle}>
            {expanded ? t('[collapse]') : t('[+%s more]', value.length - 1)}
          </button>
        </ButtonContainer>
      ) : null}
    </ArrayContainer>
  );
}

const ArrayContainer = styled('div')<{expanded: boolean}>`
  display: flex;
  flex-direction: ${p => (p.expanded ? 'column' : 'row')};

  & button {
    background: none;
    border: 0;
    outline: none;
    padding: 0;
    cursor: pointer;
    color: ${p => p.theme.linkColor};
    margin-left: ${space(0.5)};
  }
`;

const ArrayItem = styled('span')`
  flex-shrink: 1;
  display: block;

  ${p => p.theme.overflowEllipsis};
  width: unset;
`;

const ButtonContainer = styled('div')`
  white-space: nowrap;
`;

export default ArrayValue;
