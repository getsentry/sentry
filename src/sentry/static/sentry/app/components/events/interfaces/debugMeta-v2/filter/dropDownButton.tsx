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

const DropDownButton = ({isOpen, getActorProps, checkedQuantity}: Props) => {
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
};

export default DropDownButton;

const StyledDropdownButton = styled(DropdownButton)`
  border-right: 0;
  z-index: ${p => p.theme.zIndex.dropdown};
  max-width: 200px;
  white-space: nowrap;
  border-top-right-radius: 0;
  border-bottom-right-radius: 0;
`;
