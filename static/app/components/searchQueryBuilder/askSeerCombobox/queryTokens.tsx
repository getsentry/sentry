import styled from '@emotion/styled';

import {Chip} from '@sentry/scraps/chip';
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
import {TruncatedFilterDisplayValue} from 'sentry/components/searchQueryBuilder/tokens/filter/filter';
import {parseQueryBuilderValue} from 'sentry/components/searchQueryBuilder/utils';
import {t} from 'sentry/locale';
import {isEquation, stripEquationPrefix} from 'sentry/utils/discover/fields';
import {useProjects} from 'sentry/utils/useProjects';

const MAX_PROJECT_CHIPS = 3;

export function QueryTokens(props: QueryTokensProps) {
  const normalizedDateTimeParams = normalizeSeerDateTimeParams(props);

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
  const tokens: React.ReactNode[] = [];
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
      <Stack key="filter" minWidth="0" maxWidth="100%">
        <ExploreParamTitle>{t('Filter')}</ExploreParamTitle>
        <Stack gap="xs">
          {parsedQuery
            .filter(({text}) => text.trim() !== '')
            .map(({text}) => (
              <FormattedQueryWrapper key={text}>
                <ProvidedFormattedQuery query={text} useCompoundChips />
              </FormattedQueryWrapper>
            ))}
        </Stack>
      </Stack>
    );
  }

  if (visualizations && visualizations.length > 0) {
    tokens.push(
      <Stack key="visualization" minWidth="0" maxWidth="100%">
        <ExploreParamTitle>{t('Visualization')}</ExploreParamTitle>
        <Stack as="span" gap="xs">
          {visualizations.map((visualization, vIdx) =>
            visualization.yAxes.map(yAxis => (
              <ResolvedValueChip key={`${vIdx}-${yAxis}`}>
                {isEquation(yAxis) ? stripEquationPrefix(yAxis) : yAxis}
              </ResolvedValueChip>
            ))
          )}
        </Stack>
      </Stack>
    );
  }

  if (interval) {
    tokens.push(
      <Stack key="interval" minWidth="0" maxWidth="100%">
        <ExploreParamTitle>{t('Interval')}</ExploreParamTitle>
        <Stack as="span" gap="xs">
          <ResolvedValueChip>{interval}</ResolvedValueChip>
        </Stack>
      </Stack>
    );
  }

  if (groupBys && groupBys.length > 0) {
    tokens.push(
      <Stack key="groupBy" minWidth="0" maxWidth="100%">
        <ExploreParamTitle>{t('Group By')}</ExploreParamTitle>
        <Stack as="span" gap="xs">
          {groupBys.map((groupBy, idx) => (
            <ResolvedValueChip key={idx}>{groupBy}</ResolvedValueChip>
          ))}
        </Stack>
      </Stack>
    );
  }

  // Display absolute date range if start and end are provided
  if (start && end) {
    tokens.push(
      <Stack key="timeRange" minWidth="0" maxWidth="100%">
        <ExploreParamTitle>{t('Time Range')}</ExploreParamTitle>
        <Flex as="span" wrap="wrap" gap="xs">
          <ResolvedValueChip>{formatDateRange(start, end, ' - ')}</ResolvedValueChip>
        </Flex>
      </Stack>
    );
  } else if (statsPeriod && statsPeriod.length > 0) {
    tokens.push(
      <Stack key="timeRange" minWidth="0" maxWidth="100%">
        <ExploreParamTitle>{t('Time Range')}</ExploreParamTitle>
        <Stack as="span" gap="xs">
          <ResolvedValueChip>{statsPeriod}</ResolvedValueChip>
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
      <Stack key="projects" minWidth="0" maxWidth="100%">
        <ExploreParamTitle>{t('Projects')}</ExploreParamTitle>
        <Stack as="span" gap="xs">
          {shownSlugs.map(slug => (
            <ResolvedValueChip key={slug}>{slug}</ResolvedValueChip>
          ))}
          {overflowCount > 0 ? (
            <ResolvedValueChip>{t('+%s more', overflowCount)}</ResolvedValueChip>
          ) : null}
        </Stack>
      </Stack>
    );
  }

  if (sort && sort.length > 0) {
    const descending = sort[0] === '-';
    const rawSort = descending ? sort.slice(1) : sort;
    const formattedSort = isEquation(rawSort) ? stripEquationPrefix(rawSort) : rawSort;
    tokens.push(
      <Stack key="sort" minWidth="0" maxWidth="100%">
        <ExploreParamTitle>{t('Sort')}</ExploreParamTitle>
        <Stack as="span" gap="xs">
          <ResolvedValueChip>
            {formattedSort + (descending ? ' Desc' : ' Asc')}
          </ResolvedValueChip>
        </Stack>
      </Stack>
    );
  }

  const crossEventTokens: React.ReactNode[] = [];
  crossEvents?.forEach((crossEvent, idx) => {
    const filterQuery = getCrossEventFilterQuery(crossEvent);
    const parsedCrossEvent = filterQuery
      ? parseQueryBuilderValue(filterQuery, getFieldDefinition)
      : null;

    crossEventTokens.push(
      <Stack key={`${crossEvent.type}-${idx}`} minWidth="0" maxWidth="100%">
        <ExploreParamTitle>{t('Cross Event Filter:')}</ExploreParamTitle>
        <Flex gap="md" wrap="wrap">
          <Stack gap="xs" minWidth="0" maxWidth="100%">
            <ExploreParamTitle>{t('Dataset')}</ExploreParamTitle>
            <Container>
              <ResolvedValueChip>{crossEvent.type}</ResolvedValueChip>
            </Container>
          </Stack>
          <Stack gap="xs" minWidth="0" maxWidth="100%">
            <ExploreParamTitle>{t('Filter')}</ExploreParamTitle>
            <Stack gap="xs">
              {parsedCrossEvent
                ?.filter(({text}) => text.trim() !== '')
                .map(({text}) => (
                  <FormattedQueryWrapper key={text}>
                    <ProvidedFormattedQuery query={text} useCompoundChips />
                  </FormattedQueryWrapper>
                ))}
            </Stack>
          </Stack>
        </Flex>
      </Stack>
    );
  });

  return (
    <Stack gap="xl" padding="md">
      {tokens.length > 0 ? (
        <Flex gap="xl" wrap="wrap">
          {tokens}
        </Flex>
      ) : null}
      {crossEventTokens.length > 0 ? (
        <Flex gap="xl" wrap="wrap">
          {crossEventTokens}
        </Flex>
      ) : null}
    </Stack>
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

function ResolvedValueChip({children}: {children: string}) {
  return (
    <ResolvedValueChipRoot size="sm">
      <Chip.Value variant="primary">
        <TruncatedFilterDisplayValue value={children} />
      </Chip.Value>
    </ResolvedValueChipRoot>
  );
}

const ResolvedValueChipRoot = styled(Chip.Root)`
  width: fit-content;
  max-width: 100%;
  min-width: 0;

  & > * {
    min-width: 0;
    overflow: hidden;
  }

  & > * > * {
    display: block;
    min-width: 0;
    width: 100%;
    overflow: hidden;
  }
`;

const FormattedQueryWrapper = styled('span')`
  display: block;
  width: fit-content;
  min-width: 0;
  max-width: 100%;
`;
