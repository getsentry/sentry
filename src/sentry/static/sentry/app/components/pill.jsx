import React from 'react';
import styled from 'styled-components';

/*
<Pills>
  <Pill name="id" value={data.id} />
  <Pill name="name" value={data.name} />
  <Pill name="was active" value={data.current} />
  <Pill name="crashed" value={!data.crashed}>{data.crashed ? 'yes' : 'no'}</Pill>
</Pills>
*/

export default function Pill({name, value, children}) {
  let valueElement = <PillValue>{children}</PillValue>;

  // If there's a value set rather than children

  if (value === true) {
    valueElement = <PillValueTrue>{children || 'yes'}</PillValueTrue>;
  } else if (value === false) {
    valueElement = <PillValueFalse>{children || 'no'}</PillValueFalse>;
  } else if (value === null) {
    valueElement = <PillValueFalse>{children || 'n/a'}</PillValueFalse>;
  } else if (typeof value !== 'undefined') {
    valueElement = <PillValue>{value.toString()}</PillValue>;
  }

  return (
    <PillContainer>
      <PillKey>{name}</PillKey>
      {valueElement}
    </PillContainer>
  );
}

Pill.propTypes = {
  name: React.PropTypes.string,
  value: React.PropTypes.any
};

const PillKey = styled.div`
  padding: 4px 8px;
  min-width: 0;
  white-space: nowrap;
`;

const PillValue = styled.div`
  padding: 4px 8px;
  min-width: 0;
  white-space: nowrap;
  background: ${props => props.theme.gray10};
  border-left: 1px solid ${props => props.theme.borderColor};
  border-radius: 0 3px 3px 0;
  font-family: Monaco, monospace;
  max-width: 100%;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const PillValueTrue = styled(PillValue)`
  background: #FBFEFA;
  border: 1px solid #C7DBBD;
  margin: -1px;
  color: #6A726C;
`;

const PillValueFalse = styled(PillValue)`
  background: #FFF9F9;
  border: 1px solid #E5C4C4;
  margin: -1px;
  color: #766A6A;
`;

const PillContainer = styled.div`
  font-size: 13px;
  white-space: nowrap;
  margin: 0 10px 10px 0;
  border-radius: 1px;
  display: flex;
  border: 1px solid ${props => props.theme.borderColor};
  border-radius: 3px;
  box-shadow: 0 1px 2px rgba(0,0,0, .04);
  line-height: 1.2;
  max-width: 100%;

  &:last-child {
    margin-right: 0;
  }
`;
