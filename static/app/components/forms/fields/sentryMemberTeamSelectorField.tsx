import {useContext, useEffect, useMemo} from 'react';
import partition from 'lodash/partition';

import Avatar from 'sentry/components/avatar';
import {t} from 'sentry/locale';
import {Team} from 'sentry/types';
import {useMembers} from 'sentry/utils/useMembers';
import {useTeams} from 'sentry/utils/useTeams';
import {useTeamsById} from 'sentry/utils/useTeamsById';

import FormContext from '../formContext';

// XXX(epurkhiser): This is wrong, it should not be inheriting these props
import type {SelectFieldProps} from './selectField';
import SelectField from './selectField';

// projects can be passed as a direct prop as well
export interface RenderFieldProps extends SelectFieldProps<any> {
  avatarSize?: number;
  /**
   * Use the slug as the select field value. Without setting this the numeric id
   * of the project will be used.
   */
  valueIsSlug?: boolean;
}

function SentryMemberTeamSelectorField({
  avatarSize = 20,
  placeholder = t('Choose Teams and Members'),
  ...props
}: RenderFieldProps) {
  const {form} = useContext(FormContext);
  const {multiple} = props;
  const fieldValue = form?.getValue<string[] | null>(props.name, multiple ? [] : null);

  // Coerce value to always be a list of items
  const currentValue = useMemo(
    () =>
      Array.isArray(fieldValue) ? fieldValue : fieldValue ? [fieldValue] : undefined,
    [fieldValue]
  );

  // Ensure the current value of the fields members is loaded
  const ensureUserIds = useMemo(
    () =>
      currentValue?.filter(item => item.startsWith('user:')).map(user => user.slice(7)),
    [currentValue]
  );
  useMembers({ids: ensureUserIds});

  const {
    members,
    fetching: fetchingMembers,
    onSearch: onMemberSearch,
    loadMore: loadMoreMembers,
  } = useMembers();

  // XXX(epurkhiser): It would be nice to use an object as the value, but
  // frustratingly that is difficult likely because we're recreating this
  // object on every re-render.
  const memberOptions = members?.map(member => ({
    value: `user:${member.id}`,
    label: member.name,
    leadingItems: <Avatar user={member} size={avatarSize} />,
  }));

  // Ensure the current value of the fields teams is loaded
  const ensureTeamIds = useMemo(
    () =>
      currentValue?.filter(item => item.startsWith('team:')).map(user => user.slice(5)),
    [currentValue]
  );
  useTeamsById({ids: ensureTeamIds});

  const {
    teams,
    fetching: fetchingTeams,
    onSearch: onTeamSearch,
    loadMore: loadMoreTeams,
  } = useTeams();

  const makeTeamOption = (team: Team) => ({
    value: `team:${team.id}`,
    label: `#${team.slug}`,
    leadingItems: <Avatar team={team} size={avatarSize} />,
  });

  const [myTeams, otherTeams] = partition(teams, team => team.isMember);

  const myTeamOptions = myTeams.map(makeTeamOption);
  const otherTeamOptions = otherTeams.map(makeTeamOption);

  // TODO(epurkhiser): This is an unfortunate hack right now since we don't
  // actually load members anywhere and the useMembers and useTeams hook don't
  // handle initial loading of data.
  //
  // In the future when these things use react query we should be able to clean
  // this up.
  useEffect(
    () => {
      loadMoreMembers();
      loadMoreTeams();
    },
    // Only ensure things are loaded at mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  return (
    <SelectField
      placeholder={placeholder}
      allowClear
      onInputChange={value => {
        onMemberSearch(value);
        onTeamSearch(value);
      }}
      isLoading={fetchingMembers || fetchingTeams}
      options={[
        {
          label: t('Members'),
          options: memberOptions,
        },
        {
          label: t('My Teams'),
          options: myTeamOptions,
        },
        {
          label: t('Other Teams'),
          options: otherTeamOptions,
        },
      ]}
      {...props}
    />
  );
}

export default SentryMemberTeamSelectorField;
