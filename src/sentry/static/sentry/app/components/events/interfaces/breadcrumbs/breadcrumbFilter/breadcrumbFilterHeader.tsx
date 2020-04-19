import React from 'react';
import styled from '@emotion/styled';

import space from 'app/styles/space';
import {t, tct} from 'app/locale';
import CheckboxFancy from 'app/components/checkboxFancy/checkboxFancy';

type Props = {
  selectedQuantity: number;
  isAllSelected: boolean;
  onSelectAll: (selectAll: boolean) => void;
};

const BreadcrumbFilterHeader = ({
  selectedQuantity,
  isAllSelected,
  onSelectAll,
}: Props) => {
  const handleClick = (event: React.MouseEvent<HTMLDivElement>) => {
    event.stopPropagation();

    if (isAllSelected) {
      onSelectAll(false);
      return;
    }

    onSelectAll(true);
  };

  const getCheckboxLabel = () => {
    if (isAllSelected) {
      return t('Unselect All');
    }

    if (selectedQuantity === 0) {
      return t('Select All');
    }

    return tct('[selectedQuantity] selected', {selectedQuantity});
  };

  return (
    <Wrapper>
      <CheckboxWrapper onClick={handleClick}>
        <span>{getCheckboxLabel()}</span>
        <CheckboxFancy
          isChecked={isAllSelected}
          isIndeterminate={!isAllSelected && selectedQuantity > 0}
        />
      </CheckboxWrapper>
    </Wrapper>
  );
};

const Wrapper = styled('div')`
  display: flex;
  justify-content: flex-end;
  background-color: ${p => p.theme.offWhite};
  padding: ${space(1)};
  border-top: 1px solid ${p => p.theme.borderLight};
`;

const CheckboxWrapper = styled('div')`
  align-items: center;
  display: grid;
  grid-gap: ${space(1)};
  grid-template-columns: 1fr 16px;
  font-size: ${p => p.theme.fontSizeMedium};
`;

export default BreadcrumbFilterHeader;
