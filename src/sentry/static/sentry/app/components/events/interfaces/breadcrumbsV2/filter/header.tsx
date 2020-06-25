import React from 'react';
import styled from '@emotion/styled';

import space from 'app/styles/space';
import {t, tct} from 'app/locale';
import CheckboxFancy from 'app/components/checkboxFancy/checkboxFancy';

type Props = {
  checkedQuantity: number;
  isAllChecked: boolean;
  onCheckAll: (checkAll: boolean) => void;
};

const Header = ({checkedQuantity, isAllChecked, onCheckAll}: Props) => {
  const handleClick = (event: React.MouseEvent<HTMLDivElement>) => {
    event.stopPropagation();

    if (isAllChecked) {
      onCheckAll(false);
      return;
    }

    onCheckAll(true);
  };

  const getCheckboxLabel = () => {
    if (isAllChecked) {
      return t('Uncheck All');
    }

    if (checkedQuantity === 0) {
      return t('Check All');
    }

    return tct('[checkedQuantity] checked', {checkedQuantity});
  };

  return (
    <Wrapper>
      <CheckboxWrapper onClick={handleClick}>
        <span>{getCheckboxLabel()}</span>
        <CheckboxFancy
          isChecked={isAllChecked}
          isIndeterminate={!isAllChecked && checkedQuantity > 0}
        />
      </CheckboxWrapper>
    </Wrapper>
  );
};

export default Header;

const Wrapper = styled('div')`
  display: flex;
  background-color: ${p => p.theme.gray100};
  padding: ${space(1)} ${space(2)};
  border-bottom: 1px solid ${p => p.theme.borderDark};
  justify-content: flex-end;
`;

const CheckboxWrapper = styled('div')`
  text-align: right;
  align-items: center;
  display: grid;
  grid-gap: ${space(1)};
  grid-template-columns: minmax(100px, auto) 16px;
  font-size: ${p => p.theme.fontSizeMedium};
`;
