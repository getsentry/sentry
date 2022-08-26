import styled from '@emotion/styled';

import DropdownAutoComplete from 'sentry/components/dropdownAutoComplete';
import DropdownButton, {DropdownButtonProps} from 'sentry/components/dropdownButton';
import MenuItem from 'sentry/components/menuItem';
import {IconAdd} from 'sentry/icons/iconAdd';
import {t} from 'sentry/locale';
import {FeatureFlags} from 'sentry/types/featureFlags';

import {preDefinedFeatureFlags} from './utils';

const addFlagDropDownItems = [
  {
    value: undefined,
    label: t('Custom Flag'),
    searchKey: t('custom flag'),
  },
  ...Object.entries(preDefinedFeatureFlags).map(([key, value]) => {
    return {
      value: key,
      label: value.humanReadableName,
      searchKey: value.humanReadableName,
    };
  }),
];

type Props = Pick<DropdownButtonProps, 'size'> & {
  flags: FeatureFlags;
  hasAccess: boolean;
  onAddFlag: (key: string) => void;
};

export function AddFlagButton({hasAccess, onAddFlag, flags, size = 'sm'}: Props) {
  return (
    <DropdownAutoComplete
      alignMenu="right"
      disabled={!hasAccess}
      onSelect={item => onAddFlag(item.value)}
      items={addFlagDropDownItems
        .filter(item => {
          return !item.value || !flags[item.value];
        })
        .map(addFlagDropDownItem => ({
          ...addFlagDropDownItem,
          label: <DropDownLabel>{addFlagDropDownItem.label}</DropDownLabel>,
        }))}
    >
      {({isOpen}) => (
        <DropdownButton
          priority="primary"
          isOpen={isOpen}
          disabled={!hasAccess}
          title={hasAccess ? t('You do not have permission to add flags') : undefined}
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
