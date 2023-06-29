import {useCallback, useMemo} from 'react';
import styled from '@emotion/styled';

import TeamAvatar from 'sentry/components/avatar/teamAvatar';
import {CompactSelect, MultipleSelectProps} from 'sentry/components/compactSelect';
import {TeamSelection} from 'sentry/components/performance/teamKeyTransactionsManager';
import {t} from 'sentry/locale';
import {Organization, Project, Team} from 'sentry/types';
import {trackAnalytics} from 'sentry/utils/analytics';
import {MAX_TEAM_KEY_TRANSACTIONS} from 'sentry/utils/performance/constants';

type TeamKeyTransactionProps = Omit<
  MultipleSelectProps<string>,
  'multiple' | 'options' | 'value' | 'defaultValue' | 'onChange' | 'title'
> & {
  counts: Map<string, number> | null;
  handleToggleKeyTransaction: (selection: TeamSelection) => void;
  keyedTeams: Set<string> | null;
  organization: Organization;
  project: Project;
  teams: Team[];
  transactionName: string;
};

function TeamKeyTransaction({
  keyedTeams,
  teams,
  project,
  counts,
  handleToggleKeyTransaction,
  transactionName,
  organization,
  ...props
}: TeamKeyTransactionProps) {
  const projectTeams = useMemo(() => new Set(project.teams.map(({id}) => id)), [project]);

  const value = useMemo(
    () => (keyedTeams ? [...projectTeams].filter(teamId => keyedTeams.has(teamId)) : []),
    [keyedTeams, projectTeams]
  );

  const options = useMemo<MultipleSelectProps<string>['options']>(() => {
    const enabledTeams: Team[] = [];
    const disabledTeams: Team[] = [];

    for (const team of teams) {
      if (!projectTeams.has(team.id)) {
        continue;
      }

      if (
        !keyedTeams ||
        keyedTeams.has(team.id) ||
        !counts ||
        (counts.get(team.id) ?? 0) < MAX_TEAM_KEY_TRANSACTIONS
      ) {
        enabledTeams.push(team);
        continue;
      }

      disabledTeams.push(team);
    }

    return [
      {
        label: t('My Teams'),
        showToggleAllButton: enabledTeams.length > 1,
        options: [
          ...enabledTeams.map(team => ({
            value: team.id,
            label: `#${team.slug}`,
            leadingItems: <TeamAvatar size={18} team={team} />,
          })),
          ...disabledTeams.map(team => ({
            value: team.id,
            label: `#${team.slug}`,
            disabled: true,
            leadingItems: <TeamAvatar size={18} team={team} />,
            trailingItems: t('Max %s', MAX_TEAM_KEY_TRANSACTIONS),
          })),
        ],
      },
    ];
  }, [teams, counts, projectTeams, keyedTeams]);

  const handleChange = useCallback<NonNullable<MultipleSelectProps<string>['onChange']>>(
    opts => {
      const selection = opts.map(opt => opt.value);
      const keyed = selection.filter(id => !keyedTeams?.has(id));
      const unkeyed = keyedTeams
        ? [...keyedTeams].filter(id => !selection.includes(id))
        : selection;

      const action = keyed.length > 0 ? 'key' : 'unkey';
      trackAnalytics('performance_views.team_key_transaction.set', {
        organization,
        action,
      });

      handleToggleKeyTransaction({
        action,
        teamIds: keyed.length > 0 ? keyed : unkeyed,
        project,
        transactionName,
      });
    },
    [handleToggleKeyTransaction, keyedTeams, transactionName, organization, project]
  );

  return (
    <Wrapper>
      <CompactSelect
        multiple
        value={value}
        onChange={handleChange}
        options={options}
        searchable={options.length > 8}
        {...props}
      />
    </Wrapper>
  );
}

const Wrapper = styled('div')`
  position: relative;
  ul,
  p {
    margin: 0;
  }
`;

export default TeamKeyTransaction;
