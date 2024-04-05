import {useContext, useEffect, useMemo} from 'react';

import Avatar from 'sentry/components/avatar';
import {Tooltip} from 'sentry/components/tooltip';
import {t} from 'sentry/locale';
import type {DetailedTeam} from 'sentry/types';
import {defined} from 'sentry/utils';
import {useMembers} from 'sentry/utils/useMembers';
import {useTeamsById} from 'sentry/utils/useTeamsById';
import {useUserTeams} from 'sentry/utils/useUserTeams';

import FormContext from '../formContext';

// XXX(epurkhiser): This is wrong, it should not be inheriting these props
import type {SelectFieldProps} from './selectField';
import SelectField from './selectField';

// projects can be passed as a direct prop as well
export interface RenderFieldProps extends SelectFieldProps<any> {
  avatarSize?: number;
  /**
   * Ensures the only selectable teams and members are members of the given project
   */
  memberOfProjectSlug?: string;
  /**
   * Use the slug as the select field value. Without setting this the numeric id
   * of the project will be used.
   */
  valueIsSlug?: boolean;
}

function SentryMemberTeamSelectorField({
  avatarSize = 20,
  placeholder = t('Choose Teams and Members'),
  memberOfProjectSlug,
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

  const {teams, isLoading: loadingTeams} = useUserTeams();

  // TODO(davidenwang): Fix the team type here to avoid this type cast
  const teamOptions = (teams as DetailedTeam[])
    .map(team => {
      const isDisabledTeam =
        memberOfProjectSlug &&
        !defined(team.projects.find(({slug}) => memberOfProjectSlug === slug));
      return {
        value: `team:${team.id}`,
        leadingItems: <Avatar team={team} size={avatarSize} />,
        ...(isDisabledTeam
          ? {
              disabled: true,
              label: (
                <Tooltip
                  position="left"
                  title={t('%s is not a member of the selected project', `#${team.slug}`)}
                >
                  #{team.slug}
                </Tooltip>
              ),
            }
          : {
              disabled: false,
              label: `#${team.slug}`,
            }),
      };
    })
    .sort(({disabled: teamADisabled}, {disabled: teamBDisabled}) =>
      teamADisabled === teamBDisabled ? 0 : teamADisabled ? 1 : -1
    );

  // TODO(epurkhiser): This is an unfortunate hack right now since we don't
  // actually load members anywhere and the useMembers and useTeams hook don't
  // handle initial loading of data.
  //
  // In the future when these things use react query we should be able to clean
  // this up.
  useEffect(
    () => {
      loadMoreMembers();
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
      }}
      isLoading={fetchingMembers || loadingTeams}
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
