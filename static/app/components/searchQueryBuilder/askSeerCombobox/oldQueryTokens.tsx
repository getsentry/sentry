import {Fragment} from 'react';
import styled from '@emotion/styled';

import {Flex} from '@sentry/scraps/layout';

import type {QueryTokensProps} from 'sentry/components/searchQueryBuilder/askSeerCombobox/types';
import {
  formatDateRange,
  getCrossEventFilterQuery,
  resolveSeerProjectSelection,
} from 'sentry/components/searchQueryBuilder/askSeerCombobox/utils';
import {useSearchQueryBuilderConfig} from 'sentry/components/searchQueryBuilder/context';
import {ProvidedFormattedQuery} from 'sentry/components/searchQueryBuilder/formattedQuery';
import {parseQueryBuilderValue} from 'sentry/components/searchQueryBuilder/utils';
import {t} from 'sentry/locale';
import {useProjects} from 'sentry/utils/useProjects';

const MAX_PROJECT_CHIPS = 3;

export function OldQueryTokens({
  groupBys,
  interval,
  query,
  sort,
  statsPeriod,
  start,
  end,
  visualizations,
  expandedProjectIds,
  crossEvents,
}: QueryTokensProps) {
  const tokens = [];
  const {getFieldDefinition} = useSearchQueryBuilderConfig();
  const {projects} = useProjects();
  // Project is applied to the page-level project selector, so surface it as the
  // `Projects` chip below rather than duplicating it in the filter query.
  const {query: displayQuery, projectIds: selectedProjectIds} =
    resolveSeerProjectSelection(query ?? '', projects, expandedProjectIds);
  const parsedQuery = displayQuery
    ? parseQueryBuilderValue(displayQuery, getFieldDefinition)
    : null;
  if (displayQuery && parsedQuery?.length) {
    tokens.push(
      <Flex as="span" align="center" wrap="wrap" gap="xs" overflow="hidden" key="filter">
        <ExploreParamTitle>{t('Filter')}</ExploreParamTitle>
        {parsedQuery
          .filter(({text}) => text.trim() !== '')
          .map(({text}) => (
            <FormattedQueryWrapper key={text}>
              <ProvidedFormattedQuery query={text} />
            </FormattedQueryWrapper>
          ))}
      </Flex>
    );
  }

  if (visualizations && visualizations.length > 0) {
    tokens.push(
      <Flex
        as="span"
        align="center"
        wrap="wrap"
        gap="xs"
        overflow="hidden"
        key="visualization"
      >
        <ExploreParamTitle>{t('Visualization')}</ExploreParamTitle>
        {visualizations.map((visualization, vIdx) =>
          visualization.yAxes.map(yAxis => (
            <ExploreVisualizes key={`${vIdx}-${yAxis}`}>{yAxis}</ExploreVisualizes>
          ))
        )}
      </Flex>
    );
  }

  if (interval) {
    tokens.push(
      <Flex
        as="span"
        align="center"
        wrap="wrap"
        gap="xs"
        overflow="hidden"
        key="interval"
      >
        <ExploreParamTitle>{t('Interval')}</ExploreParamTitle>
        <ExploreGroupBys>{interval}</ExploreGroupBys>
      </Flex>
    );
  }

  if (groupBys && groupBys.length > 0) {
    tokens.push(
      <Flex as="span" align="center" wrap="wrap" gap="xs" overflow="hidden" key="groupBy">
        <ExploreParamTitle>{t('Group By')}</ExploreParamTitle>
        {groupBys.map((groupBy, idx) => (
          <ExploreGroupBys key={idx}>{groupBy}</ExploreGroupBys>
        ))}
      </Flex>
    );
  }

  // Display absolute date range if start and end are provided
  if (start && end) {
    tokens.push(
      <Flex
        as="span"
        align="center"
        wrap="wrap"
        gap="xs"
        overflow="hidden"
        key="timeRange"
      >
        <ExploreParamTitle>{t('Time Range')}</ExploreParamTitle>
        <ExploreGroupBys>{formatDateRange(start, end, ' - ')}</ExploreGroupBys>
      </Flex>
    );
  } else if (statsPeriod && statsPeriod.length > 0) {
    tokens.push(
      <Flex
        as="span"
        align="center"
        wrap="wrap"
        gap="xs"
        overflow="hidden"
        key="timeRange"
      >
        <ExploreParamTitle>{t('Time Range')}</ExploreParamTitle>
        <ExploreGroupBys>{statsPeriod}</ExploreGroupBys>
      </Flex>
    );
  }

  if (selectedProjectIds && selectedProjectIds.length > 0) {
    const shownSlugs = selectedProjectIds
      .slice(0, MAX_PROJECT_CHIPS)
      .map(id => projects.find(project => project.id === String(id))?.slug ?? String(id));
    const overflowCount = selectedProjectIds.length - shownSlugs.length;
    tokens.push(
      <Flex
        as="span"
        align="center"
        wrap="wrap"
        gap="xs"
        overflow="hidden"
        key="projects"
      >
        <ExploreParamTitle>{t('Projects')}</ExploreParamTitle>
        {shownSlugs.map(slug => (
          <ExploreGroupBys key={slug}>{slug}</ExploreGroupBys>
        ))}
        {overflowCount > 0 ? (
          <ExploreGroupBys>{t('+%s more', overflowCount)}</ExploreGroupBys>
        ) : null}
      </Flex>
    );
  }

  if (sort && sort.length > 0) {
    tokens.push(
      <Flex as="span" align="center" wrap="wrap" gap="xs" overflow="hidden" key="sort">
        <ExploreParamTitle>{t('Sort')}</ExploreParamTitle>
        <ExploreGroupBys>
          {sort[0] === '-' ? sort.slice(1) + ' Desc' : sort + ' Asc'}
        </ExploreGroupBys>
      </Flex>
    );
  }

  return (
    <Fragment>
      <TokenContainer>{tokens}</TokenContainer>
      {crossEvents?.length ? (
        <CrossEventSection>
          {crossEvents.map((crossEvent, idx) => {
            const filterQuery = getCrossEventFilterQuery(crossEvent);
            const parsedCrossEvent = filterQuery
              ? parseQueryBuilderValue(filterQuery, getFieldDefinition)
              : null;
            return (
              <Flex
                as="span"
                align="center"
                wrap="wrap"
                gap="xs"
                overflow="hidden"
                key={`${crossEvent.type}-${idx}`}
              >
                <ExploreParamTitle>{t('Cross Event Filter')}</ExploreParamTitle>
                <ExploreParamTitle>{t('Dataset')}</ExploreParamTitle>
                <ExploreGroupBys>{crossEvent.type}</ExploreGroupBys>
                <ExploreParamTitle>{t('Filter')}</ExploreParamTitle>
                {parsedCrossEvent
                  ?.filter(({text}) => text.trim() !== '')
                  .map(({text}) => (
                    <FormattedQueryWrapper key={text}>
                      <ProvidedFormattedQuery query={text} />
                    </FormattedQueryWrapper>
                  ))}
              </Flex>
            );
          })}
        </CrossEventSection>
      ) : null}
    </Fragment>
  );
}

const TokenContainer = styled('div')`
  display: flex;
  gap: ${p => p.theme.space.md};
  padding: ${p => p.theme.space.md};
`;

// Cross-event filters render as their own block beneath the main query row,
// one sibling per line, each labelled with its Dataset and Filter.
const CrossEventSection = styled('div')`
  display: flex;
  flex-direction: column;
  gap: ${p => p.theme.space.xs};
  padding: 0 ${p => p.theme.space.md} ${p => p.theme.space.md};
`;

const ExploreParamTitle = styled('span')`
  font-size: ${p => p.theme.form.sm.fontSize};
  color: ${p => p.theme.tokens.content.secondary};
  white-space: nowrap;
  display: inline-flex;
  align-items: center;
  height: 24px;
`;

const ExploreVisualizes = styled('span')`
  font-size: ${p => p.theme.form.sm.fontSize};
  background: ${p => p.theme.tokens.background.primary};
  padding: ${p => p.theme.space['2xs']} ${p => p.theme.space.xs};
  border: 1px solid ${p => p.theme.tokens.border.secondary};
  border-radius: ${p => p.theme.radius.md};
  height: 24px;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
  display: inline-flex;
  align-items: center;
`;

const ExploreGroupBys = ExploreVisualizes;

const FormattedQueryWrapper = styled('span')`
  display: inline-block;
`;
