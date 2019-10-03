import React from 'react';

import {t} from 'app/locale';
import {Team} from 'app/types';
import Button from 'app/components/button';
import SelectControl from 'app/components/forms/selectControl';

import RoleSelectControl from './roleSelectControl';
import renderEmailValue from './renderEmailValue';
import {InviteStatus} from './types';

type Props = {
  className?: string;
  disabled: boolean;
  disableRemove: boolean;
  emails: string[];
  role: string;
  teams: string[];
  roleOptions: string[];
  teamOptions: Team[];
  inviteStatus: InviteStatus;
  onRemove: () => void;

  // TODO(ts): Update when we have react-select typings
  onChangeEmails: (options: any) => void;
  onChangeRole: (value: any) => void;
  onChangeTeams: (value: any) => void;
};

const InviteRowControl = ({
  className,
  disabled,
  emails,
  role,
  teams,
  roleOptions,
  teamOptions,
  inviteStatus,
  onRemove,
  onChangeEmails,
  onChangeRole,
  onChangeTeams,
  disableRemove,
}: Props) => (
  <div className={className}>
    <div>
      <SelectControl
        disabled={disabled}
        placeholder={t('Enter one or more email')}
        value={emails}
        options={emails.map(value => ({
          value,
          label: value,
        }))}
        valueComponent={props => renderEmailValue(inviteStatus[props.value.value], props)}
        onChange={onChangeEmails}
        multiple
        creatable
        clearable
        noMenu
      />
    </div>
    <div>
      <RoleSelectControl
        disabled={disabled}
        value={role}
        roles={roleOptions}
        onChange={onChangeRole}
      />
    </div>
    <div>
      <SelectControl
        disabled={disabled}
        placeholder={t('Add to teams...')}
        value={teams}
        options={teamOptions.map(({slug}) => ({
          value: slug,
          label: `#${slug}`,
        }))}
        onChange={onChangeTeams}
        multiple
        clearable
      />
    </div>
    <Button
      borderless
      icon="icon-close"
      size="micro"
      onClick={onRemove}
      disabled={disableRemove}
    />
  </div>
);

export default InviteRowControl;
