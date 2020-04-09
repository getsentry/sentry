import React from 'react';

import {MemberRole} from 'app/types';
import {t} from 'app/locale';
import Button from 'app/components/button';
import RoleSelectControl from 'app/components/roleSelectControl';
import SelectControl from 'app/components/forms/selectControl';
import loadTeamsForSelectOptions from 'app/utils/loadTeamsForSelectOptions';

import {InviteStatus} from './types';
import renderEmailValue from './renderEmailValue';

type Props = {
  className?: string;
  disabled: boolean;
  disableRemove: boolean;
  emails: string[];
  role: string;
  teams: string[];
  roleOptions: MemberRole[];
  roleDisabledUnallowed: boolean;
  inviteStatus: InviteStatus;
  organizationSlug: string;
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
  roleDisabledUnallowed,
  inviteStatus,
  organizationSlug,
  onRemove,
  onChangeEmails,
  onChangeRole,
  onChangeTeams,
  disableRemove,
}: Props) => (
  <div className={className}>
    <div>
      <SelectControl
        deprecatedSelectControl
        data-test-id="select-emails"
        disabled={disabled}
        placeholder={t('Enter one or more email')}
        value={emails}
        options={emails.map(value => ({
          value,
          label: value,
        }))}
        valueComponent={props => renderEmailValue(inviteStatus[props.value.value], props)}
        onBlur={e =>
          e.target.value &&
          onChangeEmails([...emails.map(value => ({value})), {value: e.target.value}])
        }
        shouldKeyDownEventCreateNewOption={({keyCode}) =>
          // Keycodes are ENTER, SPACE, TAB, COMMA
          [13, 32, 9, 188].includes(keyCode)
        }
        onBlurResetsInput={false}
        onCloseResetsInput={false}
        onChange={onChangeEmails}
        multiple
        creatable
        clearable
        noMenu
      />
    </div>
    <div>
      <RoleSelectControl
        deprecatedSelectControl
        data-test-id="select-role"
        disabled={disabled}
        value={role}
        roles={roleOptions}
        disableUnallowed={roleDisabledUnallowed}
        onChange={onChangeRole}
      />
    </div>
    <div>
      <SelectControl
        deprecatedSelectControl
        data-test-id="select-teams"
        disabled={disabled}
        placeholder={t('Add to teams...')}
        value={teams}
        loadOptions={loadTeamsForSelectOptions(organizationSlug)}
        onChange={onChangeTeams}
        async
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
