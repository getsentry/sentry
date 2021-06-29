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
        hideBottomBorder={false}
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
      hideBottomBorder={false}
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

  ${p =>
    p.isOpen &&
    `
      :before,
      :after {
        position: absolute;
        bottom: 0;
        right: 32px;
        content: '';
        width: 16px;
        border: 8px solid transparent;
        transform: translateY(calc(50% + 2px));
        right: 9px;
        border-bottom-color: ${p.theme.backgroundSecondary};
      }

      :before {
        transform: translateY(calc(50% + 1px));
        border-bottom-color: ${p.theme.border};
      }
    `}

  @media (min-width: ${p => p.theme.breakpoints[0]}) {
    border-right: 0;
    border-top-right-radius: 0;
    border-bottom-right-radius: 0;
  }
`;
