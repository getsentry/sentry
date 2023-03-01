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
  matcher: {pattern: string; type: string};
  owners: Actor[];
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
    const rules = [...projectRules, ...codeownersRules].filter(
      rule => rule.matcher.type.includes(search) || rule.matcher.pattern.includes(search)
    );

    return chunk(rules, PAGE_LIMIT);
  }, [projectRules, codeownersRules, search]);
  const hasNextPage = chunkedRules[page + 1] !== undefined;
  const hasPrevPage = page !== 0;

  useEffect(() => {
    // Reset to first page if the list of rules changes
    if (!chunkedRules[page]) {
      setPage(0);
    }
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
        {chunkedRules[page].map((rule, index) => {
          let name: string | undefined = 'unknown';
          if (rule.owners[0]?.type === 'team') {
            const team = TeamStore.getById(rule.owners[0].id);
            if (team?.slug) {
              name = `#${team.slug}`;
            }
          } else if (rule.owners[0]?.type === 'user') {
            const user = MemberListStore.getById(rule.owners[0].id);
            name = user?.name;
          }

          return (
            <Fragment key={`${rule.matcher.type}:${rule.matcher.pattern}-${index}`}>
              <RowItem>
                <Tag type="highlight">{capitalize(rule.matcher.type)}</Tag>
              </RowItem>
              <RowRule>{rule.matcher.pattern}</RowRule>
              <RowItem>
                <AvatarContainer numAvatars={Math.min(rule.owners.length, 3)}>
                  <SuggestedAvatarStack
                    owners={rule.owners}
                    suggested={false}
                    reverse={false}
                  />
                </AvatarContainer>
                {name}
                {rule.owners.length > 1 &&
                  tn(' and %s other', ' and %s others', rule.owners.length - 1)}
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
  max-width: ${p => 24 + (p.numAvatars - 1) * (24 * 0.6)}px;
`;
