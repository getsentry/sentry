import React from 'react';
import PropTypes from 'prop-types';
import styled from '@emotion/styled';
import DropdownButton from 'app/components/dropdownButton';
import DropdownControl, {DropdownItem} from 'app/components/dropdownControl';
import space from 'app/styles/space';

const YAxisSelector = props => {
  const {options, onChange, selected} = props;
  const selectedOption = options.find(opt => selected === opt.value) || options[0];

  return (
    <DropdownControl
      menuOffset="29px"
      button={({isOpen, getActorProps}) => (
        <StyledDropdownButton {...getActorProps()} size="zero" isOpen={isOpen}>
          {selectedOption.label}
        </StyledDropdownButton>
      )}
    >
      {options.map(opt => (
        <StyledDropdownItem
          key={opt.value}
          onSelect={onChange}
          eventKey={opt.value}
          isActive={selected === opt.value}
        >
          {opt.label}
        </StyledDropdownItem>
      ))}
    </DropdownControl>
  );
};

const StyledDropdownButton = styled(
  React.forwardRef((prop, ref) => <DropdownButton ref={ref} {...prop} />)
)`
  border-radius: ${p =>
    p.isOpen && `${p.theme.borderRadius} ${p.theme.borderRadius} 0 0`};
  padding: ${space(1)} ${space(2)};
  min-width: 200px;
`;

const StyledDropdownItem = styled(DropdownItem)`
  color: inherit;
`;

YAxisSelector.propTypes = {
  options: PropTypes.array.isRequired,
  onChange: PropTypes.func.isRequired,
  selected: PropTypes.string,
};

export default YAxisSelector;
