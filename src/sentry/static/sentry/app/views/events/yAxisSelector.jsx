import React from 'react';
import PropTypes from 'prop-types';
import styled from '@emotion/styled';
import DropdownButton from 'app/components/dropdownButton';
import DropdownControl, {DropdownItem} from 'app/components/dropdownControl';
import {t} from 'app/locale';
import space from 'app/styles/space';
import {SectionHeading} from '../eventsV2/styles';

const YAxisSelector = props => {
  const {options, onChange, selected} = props;
  const selectedOption = options.find(opt => selected === opt.value) || options[0];

  return (
    <ChartControls>
      <StyledLabel>{t('Y-Axis')}</StyledLabel>
      <DropdownControl
        menuOffset="29px"
        button={({isOpen, getActorProps}) => (
          <StyledDropdownButton {...getActorProps()} size="zero" isOpen={isOpen}>
            {selectedOption.label}
          </StyledDropdownButton>
        )}
      >
        {options.map(opt => (
          <DropdownItem
            key={opt.value}
            onSelect={onChange}
            eventKey={opt.value}
            isActive={selected === opt.value}
          >
            {opt.label}
          </DropdownItem>
        ))}
      </DropdownControl>
    </ChartControls>
  );
};

const StyledDropdownButton = styled(DropdownButton)`
  border-radius: ${p =>
    p.isOpen && `${p.theme.borderRadius} ${p.theme.borderRadius} 0 0`};
  padding: ${space(1)} ${space(2)};
  font-weight: normal;
  min-width: 180px;
  color: ${p => p.theme.gray4};

  &:hover,
  &:focus {
    color: inherit;
  }
`;

const ChartControls = styled('div')`
  display: flex;
  justify-content: flex-end;
  padding: ${space(1)};
  border-top: 1px solid ${p => p.theme.borderLight};
`;

const StyledLabel = styled(SectionHeading)`
  padding-right: ${space(1)};
  line-height: 1.2;
`;

YAxisSelector.propTypes = {
  options: PropTypes.array.isRequired,
  onChange: PropTypes.func.isRequired,
  selected: PropTypes.string,
};

export default YAxisSelector;
