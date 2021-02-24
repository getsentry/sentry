import React from 'react';
import styled from '@emotion/styled';

import DropdownButton from 'app/components/dropdownButton';
import {GetActorPropsFn} from 'app/components/dropdownMenu';
import {t, tn} from 'app/locale';

type Props = {
  isOpen: boolean;
  getActorProps: GetActorPropsFn;
  checkedQuantity: number;
};

function DropDownButton({isOpen, getActorProps, checkedQuantity}: Props) {
  if (checkedQuantity > 0) {
    return (
      <StyledDropdownButton
        {...getActorProps()}
        isOpen={isOpen}
        size="small"
        hideBottomBorder={isOpen}
        priority="primary"
      >
        {tn('%s Active Filter', '%s Active Filters', checkedQuantity)}
      </StyledDropdownButton>
    );
  }

  return (
    <StyledDropdownButton
      {...getActorProps()}
      isOpen={isOpen}
      size="small"
      hideBottomBorder={isOpen}
    >
      {t('Filter By')}
    </StyledDropdownButton>
  );
}

export default DropDownButton;

const StyledDropdownButton = styled(DropdownButton)`
  z-index: ${p => p.theme.zIndex.dropdown};
  border-radius: ${p => p.theme.borderRadius};
  max-width: 200px;
  white-space: nowrap;

  @media (min-width: ${p => p.theme.breakpoints[0]}) {
    border-right: 0;
    border-top-right-radius: 0;
    border-bottom-right-radius: 0;
  }
`;
