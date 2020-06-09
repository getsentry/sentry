import React from 'react';
import PropTypes from 'prop-types';
import styled from '@emotion/styled';

import DropdownButton from 'app/components/dropdownButton';
import {InlineContainer, SectionHeading} from 'app/components/charts/styles';
import DropdownControl, {DropdownItem} from 'app/components/dropdownControl';
import space from 'app/styles/space';

type Option = {
  label: string;
  value: string;
  disabled?: boolean;
};

type Props = {
  options: Option[];
  selected: string;
  onChange: (value: string) => void;
  title: string;
  menuWidth?: string;
};

function OptionSelector({options, onChange, selected, title, menuWidth = 'auto'}: Props) {
  const selectedOption = options.find(opt => selected === opt.value) || options[0];

  return (
    <InlineContainer>
      <SectionHeading>{title}</SectionHeading>
      <DropdownControl
        menuWidth={menuWidth}
        alignRight
        button={({getActorProps}) => (
          <StyledDropdownButton {...getActorProps()} size="zero" isOpen={false}>
            {selectedOption.label}
          </StyledDropdownButton>
        )}
      >
        {options.map(opt => (
          <DropdownItem
            key={opt.value}
            onSelect={onChange}
            eventKey={opt.value}
            disabled={opt.disabled}
            isActive={selected === opt.value}
            data-test-id={`option-${opt.value}`}
          >
            {opt.label}
          </DropdownItem>
        ))}
      </DropdownControl>
    </InlineContainer>
  );
}

const StyledDropdownButton = styled(DropdownButton)`
  padding: ${space(1)} ${space(2)};
  font-weight: normal;
  color: ${p => p.theme.gray600};

  &:hover,
  &:focus,
  &:active {
    color: ${p => p.theme.gray700};
  }
`;

OptionSelector.propTypes = {
  options: PropTypes.array.isRequired,
  onChange: PropTypes.func.isRequired,
  title: PropTypes.string.isRequired,
  selected: PropTypes.string,
};

export default OptionSelector;
