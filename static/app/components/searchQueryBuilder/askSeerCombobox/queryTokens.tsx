import styled from '@emotion/styled';

import {Container, Flex, Stack} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import type {QueryTokensProps} from 'sentry/components/searchQueryBuilder/askSeerCombobox/types';
import {
  formatDateRange,
  getCrossEventFilterQuery,
  normalizeSeerDateTimeParams,
  resolveSeerProjectSelection,
} from 'sentry/components/searchQueryBuilder/askSeerCombobox/utils';
import {useSearchQueryBuilderConfig} from 'sentry/components/searchQueryBuilder/context';
import {ProvidedFormattedQuery} from 'sentry/components/searchQueryBuilder/formattedQuery';
import {parseQueryBuilderValue} from 'sentry/components/searchQueryBuilder/utils';
import {t} from 'sentry/locale';
import {useOrganization} from 'sentry/utils/useOrganization';
import {useProjects} from 'sentry/utils/useProjects';

import {OldQueryTokens} from './oldQueryTokens';

const MAX_PROJECT_CHIPS = 3;

export function QueryTokens(props: QueryTokensProps) {
  const organization = useOrganization();
  const normalizedDateTimeParams = normalizeSeerDateTimeParams(props);

  if (!organization.features.includes('gen-ai-ask-seer-ux-rework')) {
    return <OldQueryTokens {...props} {...normalizedDateTimeParams} />;
  }

  return <NewQueryTokens {...props} {...normalizedDateTimeParams} />;
}

function NewQueryTokens({
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
      <Stack key="filter">
        <ExploreParamTitle>{t('Filter')}</ExploreParamTitle>
        <Stack gap="xs" overflow="hidden">
          {parsedQuery
            .filter(({text}) => text.trim() !== '')
            .map(({text}) => (
              <FormattedQueryWrapper key={text}>
                <ProvidedFormattedQuery query={text} />
              </FormattedQueryWrapper>
            ))}
        </Stack>
      </Stack>
    );
  }

  if (visualizations && visualizations.length > 0) {
    tokens.push(
      <Stack key="visualization">
        <ExploreParamTitle>{t('Visualization')}</ExploreParamTitle>
        <Stack as="span" gap="xs" overflow="hidden">
          {visualizations.map((visualization, vIdx) =>
            visualization.yAxes.map(yAxis => (
              <ExploreVisualizes key={`${vIdx}-${yAxis}`}>{yAxis}</ExploreVisualizes>
            ))
          )}
        </Stack>
      </Stack>
    );
  }

  if (interval) {
    tokens.push(
      <Stack key="interval">
        <ExploreParamTitle>{t('Interval')}</ExploreParamTitle>
        <Stack as="span" gap="xs" overflow="hidden">
          <ExploreGroupBys>{interval}</ExploreGroupBys>
        </Stack>
      </Stack>
    );
  }

  if (groupBys && groupBys.length > 0) {
    tokens.push(
      <Stack key="groupBy">
        <ExploreParamTitle>{t('Group By')}</ExploreParamTitle>
        <Stack as="span" gap="xs" overflow="hidden">
          {groupBys.map((groupBy, idx) => (
            <ExploreGroupBys key={idx}>{groupBy}</ExploreGroupBys>
          ))}
        </Stack>
      </Stack>
    );
  }

  // Display absolute date range if start and end are provided
  if (start && end) {
    tokens.push(
      <Stack key="timeRange">
        <ExploreParamTitle>{t('Time Range')}</ExploreParamTitle>
        <Flex as="span" wrap="wrap" gap="xs" overflow="hidden">
          <ExploreGroupBys>{formatDateRange(start, end, ' - ')}</ExploreGroupBys>
        </Flex>
      </Stack>
    );
  } else if (statsPeriod && statsPeriod.length > 0) {
    tokens.push(
      <Stack key="timeRange">
        <ExploreParamTitle>{t('Time Range')}</ExploreParamTitle>
        <Stack as="span" gap="xs" overflow="hidden">
          <ExploreGroupBys>{statsPeriod}</ExploreGroupBys>
        </Stack>
      </Stack>
    );
  }

  if (selectedProjectIds && selectedProjectIds.length > 0) {
    const shownSlugs = selectedProjectIds
      .slice(0, MAX_PROJECT_CHIPS)
      .map(id => projects.find(project => project.id === String(id))?.slug ?? String(id));
    const overflowCount = selectedProjectIds.length - shownSlugs.length;
    tokens.push(
      <Stack key="projects">
        <ExploreParamTitle>{t('Projects')}</ExploreParamTitle>
        <Stack as="span" gap="xs" overflow="hidden">
          {shownSlugs.map(slug => (
            <ExploreGroupBys key={slug}>{slug}</ExploreGroupBys>
          ))}
          {overflowCount > 0 ? (
            <ExploreGroupBys>{t('+%s more', overflowCount)}</ExploreGroupBys>
          ) : null}
        </Stack>
      </Stack>
    );
  }

  if (sort && sort.length > 0) {
    tokens.push(
      <Stack key="sort">
        <ExploreParamTitle>{t('Sort')}</ExploreParamTitle>
        <Stack as="span" gap="xs" overflow="hidden">
          <ExploreGroupBys>
            {sort[0] === '-' ? sort.slice(1) + ' Desc' : sort + ' Asc'}
          </ExploreGroupBys>
        </Stack>
      </Stack>
    );
  }

  crossEvents?.forEach((crossEvent, idx) => {
    const filterQuery = getCrossEventFilterQuery(crossEvent);
    const parsedCrossEvent = filterQuery
      ? parseQueryBuilderValue(filterQuery, getFieldDefinition)
      : null;

    tokens.push(
      <Stack overflow="hidden" key={`${crossEvent.type}-${idx}`}>
        <ExploreParamTitle>{t('Cross Event Filter:')}</ExploreParamTitle>
        <Flex gap="md">
          <Stack gap="xs">
            <ExploreParamTitle>{t('Dataset')}</ExploreParamTitle>
            <Container>
              <ExploreGroupBys>{crossEvent.type}</ExploreGroupBys>
            </Container>
          </Stack>
          <Stack gap="xs">
            <ExploreParamTitle>{t('Filter')}</ExploreParamTitle>
            <Stack gap="xs">
              {parsedCrossEvent
                ?.filter(({text}) => text.trim() !== '')
                .map(({text}) => (
                  <FormattedQueryWrapper key={text}>
                    <ProvidedFormattedQuery query={text} />
                  </FormattedQueryWrapper>
                ))}
            </Stack>
          </Stack>
        </Flex>
      </Stack>
    );
  });

  return (
    <Flex gap="xl" padding="md" wrap="wrap">
      {tokens}
    </Flex>
  );
}

function ExploreParamTitle({children}: {children: React.ReactNode}) {
  return (
    <Flex display="inline-flex" align="center" height="24px">
      {props => (
        <Text {...props} bold size="sm" textWrap="nowrap">
          {children}
        </Text>
      )}
    </Flex>
  );
}

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
