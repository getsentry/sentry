import {Fragment, useEffect, useMemo, useState} from 'react';
import {css} from '@emotion/react';
import styled from '@emotion/styled';
import capitalize from 'lodash/capitalize';
import chunk from 'lodash/chunk';

import SuggestedAvatarStack from 'sentry/components/avatar/suggestedAvatarStack';
import {Button} from 'sentry/components/button';
import ButtonBar from 'sentry/components/buttonBar';
import {PanelTable} from 'sentry/components/panels';
import SearchBar from 'sentry/components/searchBar';
import Tag from 'sentry/components/tag';
import {IconChevron} from 'sentry/icons';
import {t, tn} from 'sentry/locale';
import MemberListStore from 'sentry/stores/memberListStore';
import TeamStore from 'sentry/stores/teamStore';
import space from 'sentry/styles/space';
import {Actor} from 'sentry/types';

interface OwnershipRulesParsed {
  owners: string[];
  rule: string;
  type: string;
}

interface OwnershipRulesTableProps {
  codeownersRules: OwnershipRulesParsed[];
  projectRules: OwnershipRulesParsed[];
}

const PAGE_LIMIT = 25;

export function OwnershipRulesTable({
  projectRules,
  codeownersRules,
}: OwnershipRulesTableProps) {
  const [search, setSearch] = useState<string>('');
  const [page, setPage] = useState<number>(0);

  const chunkedRules = useMemo(() => {
    const rules = [
      ...projectRules,
      ...codeownersRules.map(rule => ({
        ...rule,
        rule: `${rule.type}:${rule.rule}`,
        type: 'codeowners',
      })),
    ].filter(rule => rule.type.includes(search) || rule.rule.includes(search));

    return chunk(rules, PAGE_LIMIT);
  }, [projectRules, codeownersRules, search]);
  const hasNextPage = chunkedRules[page + 1] !== undefined;
  const hasPrevPage = chunkedRules[page - 1] !== undefined;

  useEffect(() => {
    chunkedRules[page] && setPage(0);
  }, [chunkedRules, page]);

  const handleSearch = (value: string) => {
    setSearch(value);
    setPage(0);
    // TODO(scttcper): persist search to query parameters
  };

  return (
    <RulesTableWrapper>
      <div>
        <SearchBar
          name="ownershipSearch"
          placeholder={t('Search by type or rule')}
          query={search}
          onChange={handleSearch}
        />
      </div>

      <StyledPanelTable headers={[t('Type'), t('Rule'), t('Owner')]}>
        {chunkedRules[page].map(rule => {
          const owners = rule.owners.map(owner => {
            const [ownerType, ownerId] = owner?.split(':');
            return ownerType === 'team'
              ? {type: 'team' as Actor['type'], id: ownerId, name: ''}
              : {type: 'user' as Actor['type'], id: ownerId, name: ''};
          });
          let name: string | undefined = undefined;
          if (owners[0]?.type === 'team') {
            const team = TeamStore.getById(owners[0].id);
            name = `#${team?.slug ?? 'unknown'}`;
          } else if (owners[0]?.type === 'user') {
            const user = MemberListStore.getById(owners[0].id);
            name = user?.name;
          }

          return (
            <Fragment key={`${rule.type}${rule.rule}`}>
              <RowItem>
                <Tag type="highlight">{capitalize(rule.type)}</Tag>
              </RowItem>
              <RowRule>{rule.rule}</RowRule>
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

const RulesTableWrapper = styled('div')`
  display: flex;
  flex-direction: column;
  gap: ${space(2)};
  margin-bottom: ${space(2)};
`;

const StyledPanelTable = styled(PanelTable)`
  grid-template-columns: min-content 1fr 0.5fr;
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
`;

const RowRule = styled(RowItem)`
  font-family: ${p => p.theme.text.familyMono};
  font-size: ${p => p.theme.fontSizeSmall};
`;

const AvatarContainer = styled('div')<{numAvatars: number}>`
  width: ${p => 24 + (p.numAvatars - 1) * (24 * 0.6)}px;
`;
