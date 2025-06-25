import React, {useCallback, useState} from 'react';
import styled from '@emotion/styled';

import {addErrorMessage} from 'sentry/actionCreators/indicator';
import {Button} from 'sentry/components/core/button';
import {Input} from 'sentry/components/core/input';
import {useSearchQueryBuilder} from 'sentry/components/searchQueryBuilder/context';
import {IconClose, IconMegaphone, IconSearch, IconSeer} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {trackAnalytics} from 'sentry/utils/analytics';
import {useMutation} from 'sentry/utils/queryClient';
import useApi from 'sentry/utils/useApi';
import {useFeedbackForm} from 'sentry/utils/useFeedbackForm';
import {useNavigate} from 'sentry/utils/useNavigate';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';
import useProjects from 'sentry/utils/useProjects';
import QueryTokens from 'sentry/views/explore/components/queryTokens';
import {Mode} from 'sentry/views/explore/contexts/pageParamsContext/mode';
import {formatQueryToNaturalLanguage, getExploreUrl} from 'sentry/views/explore/utils';
import type {ChartType} from 'sentry/views/insights/common/components/chart';

interface Visualization {
  chartType: ChartType;
  yAxes: string[];
}

interface SeerSearchQuery {
  groupBys: string[];
  query: string;
  sort: string;
  statsPeriod: string;
  visualizations: Visualization[];
}

interface SeerSearchResults {
  queries: SeerSearchQuery[];
}

function SeerHeader({title, loading = false}: {title: string; loading?: boolean}) {
  return (
    <QueryResultsHeader>
      <IconSeer variant={loading ? 'loading' : 'default'} color="purple300" />
      <QueryResultsTitle>{title}</QueryResultsTitle>
    </QueryResultsHeader>
  );
}

function SeerSearchSkeleton() {
  return (
    <LoadingSkeleton>
      <SeerHeader title={t('Thinking...')} loading />
      <SkeletonCellsContainer>
        <SkeletonCell>
          <SkeletonLine width="95%" />
        </SkeletonCell>
        <SkeletonCell>
          <SkeletonLine width="50%" />
        </SkeletonCell>
        <SkeletonCell>
          <SkeletonLine width="75%" />
        </SkeletonCell>
      </SkeletonCellsContainer>
    </LoadingSkeleton>
  );
}

interface SeerSearchProps {
  initialQuery?: string;
}

export function SeerSearch({initialQuery = ''}: SeerSearchProps) {
  const formattedInitialQuery = formatQueryToNaturalLanguage(initialQuery);
  const {setDisplaySeerResults} = useSearchQueryBuilder();
  const [searchQuery, setSearchQuery] = useState(formattedInitialQuery);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const openForm = useFeedbackForm();

  const [rawResult, setRawResult] = useState<SeerSearchResults | null>(null);
  const api = useApi();
  const organization = useOrganization();
  const pageFilters = usePageFilters();
  const {projects} = useProjects();
  const memberProjects = projects.filter(p => p.isMember);
  const navigate = useNavigate();

  const {mutate: submitQuery, isPending} = useMutation({
    mutationFn: async (query: string) => {
      const selectedProjects =
        pageFilters.selection.projects &&
        pageFilters.selection.projects.length > 0 &&
        pageFilters.selection.projects[0] !== -1
          ? pageFilters.selection.projects
          : memberProjects.map(p => p.id);

      const result = await api.requestPromise(
        `/api/0/organizations/${organization.slug}/trace-explorer-ai/query/`,
        {
          method: 'POST',
          data: {
            natural_language_query: query,
            project_ids: selectedProjects,
            use_flyout: false,
            limit: 3,
          },
        }
      );
      return result;
    },
    onSuccess: result => {
      setRawResult({
        queries: result.queries.map((query: any) => ({
          query: query?.query,
          groupBys: query?.group_by ?? [],
          visualizations:
            query?.visualization?.map((v: any) => ({
              chartType: v?.chart_type,
              yAxes: v?.y_axes,
            })) ?? [],
          statsPeriod: query?.stats_period ?? '',
          sort: query?.sort ?? '',
        })),
      });
    },
    onError: (error: Error) => {
      addErrorMessage(t('Failed to process AI query: %(error)s', {error: error.message}));
    },
  });

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      if (!searchQuery.trim()) {
        return;
      }

      trackAnalytics('trace.explorer.ai_query_submitted', {
        organization,
        natural_language_query: searchQuery,
      });

      submitQuery(searchQuery);
    },
    [searchQuery, submitQuery, organization]
  );

  const handleFocus = () => {
    setIsDropdownOpen(true);
  };

  const handleApply = useCallback(
    (result: SeerSearchQuery) => {
      if (!result) {
        return;
      }

      const {query, visualizations, groupBys, sort, statsPeriod} = result;

      const start = pageFilters.selection.datetime.start?.valueOf();
      const end = pageFilters.selection.datetime.end?.valueOf();

      const selection = {
        ...pageFilters.selection,
        datetime: {
          start: start
            ? new Date(start).toISOString()
            : pageFilters.selection.datetime.start,
          end: end ? new Date(end).toISOString() : pageFilters.selection.datetime.end,
          utc: pageFilters.selection.datetime.utc,
          period: statsPeriod || pageFilters.selection.datetime.period,
        },
      };
      const mode = groupBys.length > 0 ? Mode.AGGREGATE : Mode.SAMPLES;

      const visualize =
        visualizations?.map((v: Visualization) => ({
          chartType: v.chartType,
          yAxes: v.yAxes,
        })) ?? [];

      const url = getExploreUrl({
        organization,
        selection,
        query,
        visualize,
        groupBy: groupBys,
        sort,
        mode,
      });

      trackAnalytics('trace.explorer.ai_query_applied', {
        organization,
        query,
        visualize_count: visualize.length,
        group_by_count: groupBys?.length ?? 0,
      });

      navigate(url, {replace: true, preventScrollReset: true});
      setIsDropdownOpen(false);
      setDisplaySeerResults(false);
    },
    [organization, pageFilters.selection, navigate, setDisplaySeerResults]
  );

  const handleNoneOfTheseClick = () => {
    trackAnalytics('trace.explorer.ai_query_rejected', {
      organization,
      natural_language_query: searchQuery,
      num_queries_returned: rawResult?.queries?.length ?? 0,
    });

    if (openForm) {
      openForm({
        messagePlaceholder: t('Why were these queries incorrect?'),
        tags: {
          ['feedback.source']: 'trace_explorer_ai_query',
          ['feedback.owner']: 'ml-ai',
          ['feedback.natural_language_query']: searchQuery,
          ['feedback.raw_result']: JSON.stringify(rawResult).replace(/\n/g, ''),
          ['feedback.num_queries_returned']: rawResult?.queries?.length ?? 0,
        },
      });
    } else {
      addErrorMessage(t('Unable to open feedback form'));
    }
  };

  return (
    <SeerContainer>
      <SearchForm onSubmit={handleSubmit}>
        <SearchInputContainer isDropdownOpen={isDropdownOpen}>
          <SearchIcon size="sm" />
          <SearchInput
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            onFocus={handleFocus}
            placeholder={t('Ask Seer with Natural Language')}
            autoFocus
            isDropdownOpen={isDropdownOpen}
          />
          <PositionedCloseButtonContainer>
            <Button
              size="xs"
              icon={<IconClose />}
              onClick={() => {
                trackAnalytics('trace.explorer.ai_query_interface', {
                  organization,
                  action: 'closed',
                });
                setDisplaySeerResults(false);
              }}
              aria-label={t('Close Seer Search')}
              borderless
            />
          </PositionedCloseButtonContainer>
        </SearchInputContainer>
      </SearchForm>

      {isDropdownOpen && (
        <DropdownContent>
          {isPending ? (
            <SeerSearchSkeleton />
          ) : rawResult?.queries && rawResult.queries.length > 0 ? (
            <QueryResultsSection>
              <SeerHeader title={t('Do any of these queries look right to you?')} />
              {rawResult.queries.map((query: SeerSearchQuery, index: number) => (
                <QueryResultItem key={index} onClick={() => handleApply(query)}>
                  <QueryTokens
                    groupBys={query.groupBys}
                    query={query.query}
                    sort={query.sort}
                    statsPeriod={query.statsPeriod}
                    visualizations={query.visualizations}
                  />
                </QueryResultItem>
              ))}
              <NoneOfTheseItem onClick={handleNoneOfTheseClick}>
                <NoneOfTheseContent>{t('None of these')}</NoneOfTheseContent>
              </NoneOfTheseItem>
            </QueryResultsSection>
          ) : (
            <SeerContent>
              <SeerHeader title={t("Type something in and I'll do my best to help")} />
            </SeerContent>
          )}

          <SeerFooter>
            {openForm && (
              <Button
                size="xs"
                icon={<IconMegaphone />}
                onClick={() =>
                  openForm({
                    messagePlaceholder: t('How can we make Seer search better for you?'),
                    tags: {
                      ['feedback.source']: 'seer_trace_explorer_search',
                      ['feedback.owner']: 'ml-ai',
                    },
                  })
                }
              >
                {t('Give Feedback')}
              </Button>
            )}
          </SeerFooter>
        </DropdownContent>
      )}
    </SeerContainer>
  );
}

const SeerContainer = styled('div')`
  position: relative;
`;

const SearchForm = styled('form')`
  position: relative;
  z-index: 1005;
`;

const SearchInputContainer = styled('div')<{isDropdownOpen: boolean}>`
  display: flex;
  align-items: center;
  width: 100%;
  border-radius: ${p => p.theme.borderRadius};
  border-bottom-left-radius: ${p => (p.isDropdownOpen ? '0' : p.theme.borderRadius)};
  border-bottom-right-radius: ${p => (p.isDropdownOpen ? '0' : p.theme.borderRadius)};
  background: ${p => p.theme.background};
  border: 1px solid ${p => p.theme.border};
  height: 38px;

  &:focus-within {
    border-color: ${p => p.theme.purple300};
    box-shadow: ${p => p.theme.purple300} 0 0 0 1px;
  }
`;

const SearchInput = styled(Input)<{isDropdownOpen: boolean}>`
  font-size: ${p => p.theme.fontSize.md};
  line-height: 1rem;
  border: none;
  background: transparent;
  padding-left: 32px;

  &:focus {
    border: none;
    outline: none;
    box-shadow: none;
  }
`;

const DropdownContent = styled('div')`
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
  background: ${p => p.theme.background};
  border: 1px solid ${p => p.theme.border};
  border-radius: ${p => p.theme.borderRadius};
  border-top-left-radius: 0;
  border-top-right-radius: 0;
  border-top: none;
  box-shadow: ${p => p.theme.dropShadowHeavy};
  display: flex;
  flex-direction: column;
  z-index: ${p => p.theme.zIndex.dropdown};
`;

const SeerContent = styled('div')`
  flex: 1;
  display: flex;
  flex-direction: column;
`;

const SeerFooter = styled('div')`
  display: flex;
  justify-content: flex-end;
  padding: ${space(1.5)};
  border-top: 1px solid ${p => p.theme.border};
`;

const SearchIcon = styled(IconSearch)`
  color: ${p => p.theme.subText};
  height: 22px;
  position: absolute;
  top: ${space(1)};
  left: ${space(1.5)};
`;

const PositionedCloseButtonContainer = styled('div')`
  margin-left: auto;
  margin-right: ${space(1)};
  flex-shrink: 0;
`;

const QueryResultsSection = styled('div')`
  flex: 1;
  display: flex;
  flex-direction: column;
`;

const QueryResultsHeader = styled('div')`
  display: flex;
  align-items: center;
  gap: ${space(1)};

  background: ${p => p.theme.purple100};
  padding: ${space(1.5)} ${space(2)};
  width: 100%;
`;

const QueryResultsTitle = styled('h3')`
  font-size: ${p => p.theme.fontSize.md};
  font-weight: ${p => p.theme.fontWeightNormal};
  color: ${p => p.theme.textColor};
  margin: 0;
`;

const QueryResultItem = styled('div')`
  cursor: pointer;
  padding: ${space(1)} ${space(2)};
  border-bottom: 1px solid ${p => p.theme.border};
  transition: background-color 0.2s ease;

  &:hover {
    background-color: ${p => p.theme.backgroundSecondary};
  }

  &:last-child {
    border-bottom: none;
  }
`;

const NoneOfTheseItem = styled('div')`
  cursor: pointer;
  padding: ${space(1)} ${space(2)};
  border-bottom: 1px solid ${p => p.theme.border};
  transition: background-color 0.2s ease;
  user-select: none;
  color: ${p => p.theme.subText};
  font-size: ${p => p.theme.fontSize.md};

  &:hover {
    background-color: ${p => p.theme.backgroundSecondary};
  }

  &:last-child {
    border-bottom: none;
  }
`;

const NoneOfTheseContent = styled('div')`
  display: flex;
  gap: ${space(1)};
  padding: ${space(1)};
`;

const LoadingSkeleton = styled('div')`
  flex: 1;
  display: flex;
  flex-direction: column;
`;

const SkeletonCellsContainer = styled('div')`
  display: flex;
  flex-direction: column;
  gap: ${space(1)};
`;

const SkeletonCell = styled('div')`
  padding: ${space(1)} ${space(2)};
  border-bottom: 1px solid ${p => p.theme.border};
  display: flex;
  flex-direction: column;
  gap: ${space(0.5)};

  &:last-child {
    border-bottom: none;
  }
`;

const SkeletonLine = styled('div')<{width: string}>`
  height: 16px;
  width: ${p => p.width};
  background: ${p => p.theme.gray200};
  border-radius: 4px;
  animation: pulse 1.5s ease-in-out infinite;

  @keyframes pulse {
    0% {
      opacity: 1;
    }
    50% {
      opacity: 0.4;
    }
    100% {
      opacity: 1;
    }
  }
`;
