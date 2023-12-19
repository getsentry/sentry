import {useState} from 'react';
import {MultiValueProps} from 'react-select';
import {Theme, useTheme} from '@emotion/react';

import {Button} from 'sentry/components/button';
import SelectControl, {
  StylesConfig,
} from 'sentry/components/forms/controls/selectControl';
import RoleSelectControl from 'sentry/components/roleSelectControl';
import TeamSelector from 'sentry/components/teamSelector';
import {IconClose} from 'sentry/icons/iconClose';
import {t} from 'sentry/locale';
import {OrgRole, SelectValue} from 'sentry/types';

import renderEmailValue from './renderEmailValue';
import {InviteStatus} from './types';

type SelectOption = SelectValue<string>;

type Props = {
  disableRemove: boolean;
  disabled: boolean;
  emails: string[];
  inviteStatus: InviteStatus;
  onChangeEmails: (emails: SelectOption[]) => void;
  onChangeRole: (role: SelectOption) => void;
  onChangeTeams: (teams: SelectOption[]) => void;
  onRemove: () => void;
  role: string;
  roleDisabledUnallowed: boolean;
  roleOptions: OrgRole[];
  teams: string[];
  className?: string;
};

function ValueComponent(
  props: MultiValueProps<SelectOption>,
  inviteStatus: Props['inviteStatus']
) {
  return renderEmailValue(inviteStatus[props.data.value], props);
}

function mapToOptions(values: string[]): SelectOption[] {
  return values.map(value => ({value, label: value}));
}

function InviteRowControl({
  className,
  disabled,
  emails,
  role,
  teams,
  roleOptions,
  roleDisabledUnallowed,
  inviteStatus,
  onRemove,
  onChangeEmails,
  onChangeRole,
  onChangeTeams,
  disableRemove,
}: Props) {
  const [inputValue, setInputValue] = useState('');

  const theme = useTheme();

  const handleKeyDown = (event: React.KeyboardEvent<HTMLElement>) => {
    switch (event.key) {
      case 'Enter':
      case ',':
      case ' ':
        onChangeEmails([...mapToOptions(emails), {label: inputValue, value: inputValue}]);
        setInputValue('');
        event.preventDefault();
        break;
      default:
      // do nothing.
    }
  };

  return (
    <li className={className}>
      <SelectControl
        aria-label={t('Email Addresses')}
        data-test-id="select-emails"
        disabled={disabled}
        placeholder={t('Enter one or more emails')}
        inputValue={inputValue}
        value={emails}
        components={{
          MultiValue: props => ValueComponent(props, inviteStatus),
          DropdownIndicator: () => null,
        }}
        options={mapToOptions(emails)}
        onBlur={(e: React.ChangeEvent<HTMLInputElement>) =>
          e.target.value &&
          onChangeEmails([
            ...mapToOptions(emails),
            {label: e.target.value, value: e.target.value},
          ])
        }
        styles={getStyles(theme, inviteStatus)}
        onInputChange={setInputValue}
        onKeyDown={handleKeyDown}
        onChange={onChangeEmails}
        multiple
        creatable
        clearable
        menuIsOpen={false}
      />
      <RoleSelectControl
        aria-label={t('Role')}
        data-test-id="select-role"
        disabled={disabled}
        value={role}
        roles={roleOptions}
        disableUnallowed={roleDisabledUnallowed}
        onChange={onChangeRole}
      />
      <TeamSelector
        aria-label={t('Add to Team')}
        data-test-id="select-teams"
        disabled={disabled}
        placeholder={t('None')}
        value={teams}
        onChange={onChangeTeams}
        multiple
        clearable
      />
      <Button
        borderless
        icon={<IconClose />}
        onClick={onRemove}
        disabled={disableRemove}
        aria-label={t('Remove')}
      />
    </li>
  );
}

/**
 * The email select control has custom selected item states as items
 * show their delivery status after the form is submitted.
 */
function getStyles(theme: Theme, inviteStatus: Props['inviteStatus']): StylesConfig {
  return {
    multiValue: (provided, {data}: MultiValueProps<SelectOption>) => {
      const status = inviteStatus[data.value];
      return {
        ...provided,
        ...(status?.error
          ? {
              color: theme.red400,
              border: `1px solid ${theme.red300}`,
              backgroundColor: theme.red100,
            }
          : {}),
      };
    },
    multiValueLabel: (provided, {data}: MultiValueProps<SelectOption>) => {
      const status = inviteStatus[data.value];
      return {
        ...provided,
        pointerEvents: 'all',
        ...(status?.error ? {color: theme.red400} : {}),
      };
    },
    multiValueRemove: (provided, {data}: MultiValueProps<SelectOption>) => {
      const status = inviteStatus[data.value];
      return {
        ...provided,
        ...(status?.error
          ? {
              borderLeft: `1px solid ${theme.red300}`,
              ':hover': {backgroundColor: theme.red100, color: theme.red400},
            }
          : {}),
      };
    },
  };
}

export default InviteRowControl;
