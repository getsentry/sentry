import {Fragment, useEffect, useMemo, useState} from 'react';
import {css} from '@emotion/react';
import styled from '@emotion/styled';
import chunk from 'lodash/chunk';
import isEqual from 'lodash/isEqual';
import uniqBy from 'lodash/uniqBy';

import SuggestedAvatarStack from 'sentry/components/avatar/suggestedAvatarStack';
import {Button} from 'sentry/components/button';
import ButtonBar from 'sentry/components/buttonBar';
import {Tag} from 'sentry/components/core/badge/tag';
import {PanelTable} from 'sentry/components/panels/panelTable';
import SearchBar from 'sentry/components/searchBar';
import {IconChevron} from 'sentry/icons';
import {t, tn} from 'sentry/locale';
import MemberListStore from 'sentry/stores/memberListStore';
import TeamStore from 'sentry/stores/teamStore';
import {space} from 'sentry/styles/space';
import type {ParsedOwnershipRule} from 'sentry/types/group';
import type {CodeOwner} from 'sentry/types/integrations';
import {useTeams} from 'sentry/utils/useTeams';
import {useUser} from 'sentry/utils/useUser';
import {OwnershipOwnerFilter} from 'sentry/views/settings/project/projectOwnership/ownershipOwnerFilter';

interface OwnershipRulesTableProps {
  codeowners: CodeOwner[];
  projectRules: ParsedOwnershipRule[];
}

/**
 * Once we mash the rules together we need codeowners id for more context
 */
interface MixedOwnershipRule extends ParsedOwnershipRule {
  codeownersId?: string;
}

const PAGE_LIMIT = 25;

export function OwnershipRulesTable({
  projectRules,
  codeowners,
}: OwnershipRulesTableProps) {
  const user = useUser();
  const [search, setSearch] = useState<string>('');
  const [page, setPage] = useState<number>(0);
  const [selectedActors, setSelectedActors] = useState<string[] | null>(null);
  const {teams} = useTeams({provideUserTeams: true});

  const combinedRules = useMemo(() => {
    const codeownerRulesWithId = codeowners.flatMap<MixedOwnershipRule>(owners =>
      (owners.schema?.rules ?? []).map(rule => ({
        ...rule,
        codeownersId: owners.id,
      }))
    );

    return [...codeownerRulesWithId, ...projectRules];
  }, [projectRules, codeowners]);

  /**
   * All unique actors from both codeowners and project rules
   */
  const allActors = useMemo(() => {
    const actors = combinedRules
      .flatMap(rule => rule.owners)
      .filter(actor => actor.name)
      .map(owner => ({...owner, id: `${owner.id}`}));
    return (
      uniqBy(actors, actor => `${actor.type}:${actor.id}`)
        // Sort by type, then by name
        // Teams first, then users
        .sort((a, b) => {
          if (a.type === 'team' && b.type === 'user') {
            return -1;
          }
          if (a.type === 'user' && b.type === 'team') {
            return 1;
          }
          return a.name.localeCompare(b.name);
        })
    );
  }, [combinedRules]);

  const myTeams = useMemo(() => {
    const memberTeamsIds = teams.filter(team => team.isMember).map(team => team.id);
    return allActors.filter(actor => {
      if (actor.type === 'user') {
        return actor.id === user.id;
      }

      return memberTeamsIds.includes(actor.id);
    });
  }, [allActors, teams, user]);

  useEffect(() => {
    if (myTeams.length > 0 && selectedActors === null) {
      setSelectedActors(myTeams.map(actor => `${actor.type}:${actor.id}`));
    }
  }, [myTeams, selectedActors]);

  /**
   * Rules chunked into pages
   */
  const chunkedRules = useMemo(() => {
    const filteredRules: MixedOwnershipRule[] = combinedRules.filter(
      rule =>
        // Filter by query
        (rule.matcher.type.includes(search) || rule.matcher.pattern.includes(search)) &&
        // Selected actors not set
        (selectedActors === null ||
          // Selected actors was cleared
          selectedActors.length === 0 ||
          rule.owners.some(owner => selectedActors.includes(`${owner.type}:${owner.id}`)))
    );

    return chunk(filteredRules, PAGE_LIMIT);
  }, [combinedRules, search, selectedActors]);

  const hasNextPage = chunkedRules[page + 1] !== undefined;
  const hasPrevPage = page !== 0;

  useEffect(() => {
    // Reset to first page if the list of rules changes
    if (!chunkedRules[page]) {
      setPage(0);
    }
  }, [chunkedRules, page]);

  const handleChangeFilter = (activeFilters: string[]) => {
    setSelectedActors(activeFilters.length > 0 ? activeFilters : []);
  };

  const handleSearch = (value: string) => {
    setSearch(value);
    setPage(0);
    // TODO(scttcper): persist search to query parameters
  };

  return (
    <RulesTableWrapper data-test-id="ownership-rules-table">
      <SearchAndSelectorWrapper>
        <OwnershipOwnerFilter
          actors={allActors}
          selectedTeams={selectedActors ?? []}
          handleChangeFilter={handleChangeFilter}
          isMyTeams={
            !!selectedActors &&
            selectedActors.length > 0 &&
            isEqual(
              selectedActors,
              myTeams.map(actor => `${actor.type}:${actor.id}`)
            )
          }
        />
        <StyledSearchBar
          name="ownershipSearch"
          placeholder={t('Search by type or rule')}
          query={search}
          onChange={handleSearch}
        />
      </SearchAndSelectorWrapper>

      <StyledPanelTable
        headers={[t('Type'), t('Rule'), t('Owner')]}
        isEmpty={chunkedRules.length === 0}
        emptyMessage={t('No ownership rules found')}
      >
        {chunkedRules[page]?.map((rule, index) => {
          let name: string | undefined = 'unknown';
          // ID might not be a string, so we need to convert it
          const owners = rule.owners.map(owner => ({...owner, id: `${owner.id}`}));
          if (owners[0]?.type === 'team') {
            const team = TeamStore.getById(owners[0].id);
            if (team?.slug) {
              name = `#${team.slug}`;
            }
          } else if (owners[0]?.type === 'user') {
            const firstUser = MemberListStore.getById(owners[0].id);
            name = firstUser?.name;
          }

          return (
            <Fragment key={`${rule.matcher.type}:${rule.matcher.pattern}-${index}`}>
              <RowItem>
                <Tag type="highlight">{rule.matcher.type}</Tag>
              </RowItem>
              <RowRule>{rule.matcher.pattern}</RowRule>
              <RowItem>
                <AvatarContainer numAvatars={Math.min(owners.length, 3)}>
                  <SuggestedAvatarStack
                    owners={owners}
                    suggested={false}
                    reverse={false}
                  />
                </AvatarContainer>
                {name}
                {owners.length > 1 &&
                  tn(' and %s other', ' and %s others', owners.length - 1)}
              </RowItem>
            </Fragment>
          );
        })}
      </StyledPanelTable>
      <PaginationWrapper>
        <ButtonBar merged>
          <Button
            icon={<IconChevron direction="left" size="sm" />}
            onClick={() => {
              setPage(page - 1);
            }}
            size="sm"
            disabled={!hasPrevPage}
            aria-label={t('Previous page')}
          />
          <Button
            icon={<IconChevron direction="right" size="sm" />}
            onClick={() => {
              setPage(page + 1);
            }}
            size="sm"
            disabled={!hasNextPage}
            aria-label={t('Next page')}
          />
        </ButtonBar>
      </PaginationWrapper>
    </RulesTableWrapper>
  );
}

const SearchAndSelectorWrapper = styled('div')`
  display: flex;
  align-items: center;
  gap: ${space(2)};
`;

const StyledSearchBar = styled(SearchBar)`
  flex-grow: 1;
`;

const RulesTableWrapper = styled('div')`
  display: flex;
  flex-direction: column;
  gap: ${space(2)};
  margin-bottom: ${space(2)};
`;

const StyledPanelTable = styled(PanelTable)`
  grid-template-columns: min-content minmax(1fr, max-content) auto;
  font-size: ${p => p.theme.fontSizeMedium};
  margin-bottom: 0;

  ${p =>
    !p.isEmpty &&
    css`
      & > div {
        padding: ${space(1.5)} ${space(2)};
      }
    `}
`;

const PaginationWrapper = styled('div')`
  display: flex;
  justify-content: flex-end;
`;

const RowItem = styled('div')`
  display: flex;
  align-items: center;
  gap: ${space(1)};
`;

const RowRule = styled('div')`
  display: flex;
  align-items: center;
  gap: ${space(1)};
  font-family: ${p => p.theme.text.familyMono};
  font-size: ${p => p.theme.fontSizeSmall};
  word-break: break-word;
`;

const AvatarContainer = styled('div')<{numAvatars: number}>`
  max-width: ${p => 24 + (p.numAvatars - 1) * (24 * 0.5)}px;
`;
