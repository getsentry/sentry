import {useContext, useEffect, useMemo} from 'react';

import Avatar from 'sentry/components/avatar';
import {t} from 'sentry/locale';
import {Project} from 'sentry/types';
import {useMembers} from 'sentry/utils/useMembers';
import {useTeams} from 'sentry/utils/useTeams';
import {useTeamsById} from 'sentry/utils/useTeamsById';

import FormContext from '../formContext';

// XXX(epurkhiser): This is wrong, it should not be inheriting these props
import SelectField, {SelectFieldProps} from './selectField';

// projects can be passed as a direct prop as well
export interface RenderFieldProps extends SelectFieldProps<any> {
  avatarSize?: number;
  projects?: Project[];
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
  const currentItems = form?.getValue<string[]>(props.name, []);

  // Ensure the current value of the fields members is loaded
  const ensureUserIds = useMemo(
    () =>
      currentItems?.filter(item => item.startsWith('member:')).map(user => user.slice(7)),
    [currentItems]
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
    value: `member:${member.id}`,
    label: member.name,
    leadingItems: <Avatar user={member} size={avatarSize} />,
  }));

  // Ensure the current value of the fields teams is loaded
  const ensureTeamIds = useMemo(
    () =>
      currentItems?.filter(item => item.startsWith('team:')).map(user => user.slice(5)),
    [currentItems]
  );
  useTeamsById({ids: ensureTeamIds});

  const {
    teams,
    fetching: fetchingTeams,
    onSearch: onTeamSearch,
    loadMore: loadMoreTeams,
  } = useTeams({provideUserTeams: true});

  const teamOptions = teams?.map(team => ({
    value: `team:${team.id}`,
    label: `#${team.slug}`,
    leadingItems: <Avatar team={team} size={avatarSize} />,
  }));

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
          label: t('Teams'),
          options: teamOptions,
        },
      ]}
      {...props}
    />
  );
}

export default SentryMemberTeamSelectorField;
