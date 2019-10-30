import React from 'react';
import PropTypes from 'prop-types';
import styled from 'react-emotion';
import DropdownButton from 'app/components/dropdownButton';
import DropdownControl, {DropdownItem} from 'app/components/dropdownControl';
import space from 'app/styles/space';

const YAxisSelector = props => {
  const {options, onChange, selected} = props;
  const selectedOption = options.find(opt => selected === opt.value) || options[0];

  return (
    <Container>
      <DropdownControl
        menuOffset="29px"
        button={({isOpen, getActorProps}) => (
          <StyledDropdownButton
            {...getActorProps({isStyled: true})}
            size="zero"
            isOpen={isOpen}
          >
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
    </Container>
  );
};

const StyledDropdownButton = styled(
  React.forwardRef((prop, ref) => <DropdownButton innerRef={ref} {...prop} />)
)`
  color: ${p => p.theme.gray2};
  font-weight: normal;
  text-transform: capitalize;
  height: ${space(4)};
  padding: ${space(0.5)} ${space(1)};
  background: ${p => p.theme.offWhite};
  border-radius: ${p =>
    p.isOpen
      ? `0 ${p.theme.borderRadius} 0 0`
      : `0 ${p.theme.borderRadius} 0 ${p.theme.borderRadius}`};
`;

const Container = styled('div')`
  position: absolute;
  /* compensate to have borders overlap */
  top: -1px;
  right: -1px;
`;

YAxisSelector.propTypes = {
  options: PropTypes.array.isRequired,
  onChange: PropTypes.func.isRequired,
  selected: PropTypes.string,
};

const StyledDropdownItem = styled(DropdownItem)`
  text-transform: capitalize;
`;

export default YAxisSelector;
