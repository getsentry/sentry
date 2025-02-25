import {Fragment, useMemo} from 'react';
import styled from '@emotion/styled';

import ActorAvatar from 'sentry/components/avatar/actorAvatar';
import {CompactSelect} from 'sentry/components/compactSelect';
import Badge from 'sentry/components/core/badge/badge';
import {IconUser} from 'sentry/icons';
import {t} from 'sentry/locale';
import type {Actor} from 'sentry/types/core';

interface Props {
  actors: Actor[];
  handleChangeFilter: (activeFilters: string[]) => void;
  isMyTeams: boolean;
  selectedTeams: string[];
}

export function OwnershipOwnerFilter({
  selectedTeams,
  handleChangeFilter,
  actors,
  isMyTeams,
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

  const label = useMemo(() => {
    if (isMyTeams) {
      return t('My Teams');
    }
    if (selectedTeams.length === 0) {
      return t('Everyone');
    }

    const firstActor = selectedTeams[0];
    const actor = actors.find(({type, id}) => `${type}:${id}` === firstActor);
    if (!actor) {
      return t('Unknown');
    }

    return actor.type === 'team' ? `#${actor.name}` : actor.name;
  }, [selectedTeams, actors, isMyTeams]);

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
          {label}
          {!isMyTeams && selectedTeams.length > 1 && (
            <StyledBadge text={`+${selectedTeams.length - 1}`} />
          )}
        </Fragment>
      }
      triggerProps={{icon: <IconUser />}}
    />
  );
}

const StyledBadge = styled(Badge)`
  flex-shrink: 0;
`;
