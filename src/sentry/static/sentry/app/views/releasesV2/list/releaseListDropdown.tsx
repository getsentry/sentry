import React from 'react';
import styled from '@emotion/styled';

import DropdownControl, {DropdownItem} from 'app/components/dropdownControl';

type Option = {
  key: string;
  label: string;
};

type Props = {
  label: string;
  options: Option[];
  selected: string;
  onSelect: (key: string) => void;
};

const ReleaseListDropdown = ({label, options, selected, onSelect}: Props) => {
  const labelNode = (
    <React.Fragment>
      <LabelText>{label}: &nbsp; </LabelText>
      {options.find(option => option.key === selected)?.label}
    </React.Fragment>
  );

  return (
    <DropdownControl label={labelNode}>
      {options.map(option => (
        <DropdownItem
          key={option.key}
          onSelect={onSelect}
          eventKey={option.key}
          isActive={selected === option.key}
        >
          {option.label}
        </DropdownItem>
      ))}
    </DropdownControl>
  );
};

const LabelText = styled('em')`
  font-style: normal;
  color: ${p => p.theme.gray2};
`;

export default ReleaseListDropdown;
