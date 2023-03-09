import {Fragment, useMemo} from 'react';
import styled from '@emotion/styled';

import ActorAvatar from 'sentry/components/avatar/actorAvatar';
import Badge from 'sentry/components/badge';
import {CompactSelect} from 'sentry/components/compactSelect';
import {IconUser} from 'sentry/icons';
import {t} from 'sentry/locale';
import type {Actor} from 'sentry/types';

interface Props {
  actors: Actor[];
  handleChangeFilter: (activeFilters: string[]) => void;
  selectedTeams: string[];
  /**
   * only show teams user is a member of
   */
  showIsMemberTeams?: boolean;
  /**
   * show My Teams as the default dropdown description
   */
  showMyTeamsDescription?: boolean;
}

const suggestedOptions = [
  {
    label: t('My Teams'),
    value: 'myteams',
  },
];

export function OwnershipOwnerFilter({
  selectedTeams,
  handleChangeFilter,
  showMyTeamsDescription = false,
  actors,
}: Props) {
  const actorOptions = useMemo(
    () =>
      actors.map(actor => ({
        value: `${actor.type}:${actor.id}`,
        label: actor.type === 'team' ? `#${actor.name}` : actor.name,
        leadingItems: <ActorAvatar actor={actor} size={18} />,
      })),
    [actors]
  );

  const [triggerIcon, triggerLabel] = useMemo(() => {
    const firstSelectedSuggestion =
      selectedTeams[0] && suggestedOptions.find(opt => opt.value === selectedTeams[0]);

    if (firstSelectedSuggestion) {
      return [<IconUser key={0} />, firstSelectedSuggestion.label];
    }

    return [
      <IconUser key={0} />,
      showMyTeamsDescription ? t('My Teams') : t('All Teams'),
    ];
  }, [selectedTeams, showMyTeamsDescription]);

  return (
    <CompactSelect
      multiple
      clearable
      searchable
      menuTitle={t('Filter owners')}
      options={actorOptions}
      value={selectedTeams}
      onChange={opts => {
        // Compact select type inference does not work - onChange type is actually T | null.
        if (!opts) {
          return handleChangeFilter([]);
        }
        return handleChangeFilter(opts.map(opt => opt.value));
      }}
      triggerLabel={
        <Fragment>
          {triggerLabel}
          {selectedTeams.length > 1 && (
            <StyledBadge text={`+${selectedTeams.length - 1}`} />
          )}
        </Fragment>
      }
      triggerProps={{icon: triggerIcon}}
    />
  );
}

const StyledBadge = styled(Badge)`
  flex-shrink: 0;
`;
