import styled from '@emotion/styled';

import DropdownAutoComplete from 'sentry/components/dropdownAutoComplete';
import DropdownButton from 'sentry/components/dropdownButton';
import MenuItem from 'sentry/components/menuItem';
import {IconAdd} from 'sentry/icons/iconAdd';
import {t} from 'sentry/locale';
import {AddFlagDropDownType} from 'sentry/types/featureFlags';

const addFlagDropDownItems = [
  {
    value: AddFlagDropDownType.PREDEFINED,
    label: t('Predefined flag'),
    searchKey: t('predefined flag'),
  },
  {
    value: AddFlagDropDownType.CUSTOM,
    label: t('Custom flag'),
    searchKey: t('custom flag'),
  },
];

type Props = {
  disabled: boolean;
  onAddFlag: (type: AddFlagDropDownType) => void;
  size?: 'sm' | 'md';
};

export function AddFlagButton({disabled, onAddFlag, size = 'sm'}: Props) {
  return (
    <DropdownAutoComplete
      alignMenu="right"
      disabled={disabled}
      onSelect={item => onAddFlag(item.value)}
      items={addFlagDropDownItems.map(addFlagDropDownItem => ({
        ...addFlagDropDownItem,
        label: <DropDownLabel>{addFlagDropDownItem.label}</DropDownLabel>,
      }))}
    >
      {({isOpen}) => (
        <DropdownButton
          priority="primary"
          isOpen={isOpen}
          disabled={disabled}
          title={disabled ? t('You do not have permission to add flags') : undefined}
          size={size}
          aria-label={t('Add Flag')}
          icon={<IconAdd isCircled />}
        >
          {t('Add Flag')}
        </DropdownButton>
      )}
    </DropdownAutoComplete>
  );
}

const DropDownLabel = styled(MenuItem)`
  color: ${p => p.theme.textColor};
  font-size: ${p => p.theme.fontSizeMedium};
  font-weight: 400;
  text-transform: none;
  span {
    padding: 0;
  }
`;
