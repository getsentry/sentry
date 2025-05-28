import React, {useCallback, useState} from 'react';
import styled from '@emotion/styled';

import {addErrorMessage} from 'sentry/actionCreators/indicator';
import {SeerIcon, SeerLoadingIcon} from 'sentry/components/ai/SeerIcon';
import {Button} from 'sentry/components/core/button';
import {Input} from 'sentry/components/core/input';
import {useSearchQueryBuilder} from 'sentry/components/searchQueryBuilder/context';
import {IconClose, IconMegaphone, IconSearch} from 'sentry/icons';
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
import {getExploreUrl} from 'sentry/views/explore/utils';
import type {ChartType} from 'sentry/views/insights/common/components/chart';

interface Visualization {
  chart_type: ChartType;
  y_axes: string[];
}

export function SeerHeader({title, loading = false}: {title: string; loading?: boolean}) {
  return (
    <QueryResultsHeader>
      {loading ? <StyledSeerLoadingIcon /> : <StyledIconSeer />}
      <QueryResultsTitle>{title}</QueryResultsTitle>
    </QueryResultsHeader>
  );
}

export function SeerSearchSkeleton() {
  return (
    <LoadingSkeleton>
      <SeerHeader title={t('Seer is thinking...')} loading />
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

export function SeerSearch() {
  const {setSeerMode} = useSearchQueryBuilder();
  const [searchQuery, setSearchQuery] = useState('');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const openForm = useFeedbackForm();

  const [rawResult, setRawResult] = useState<any>(null);
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
      setRawResult(result);
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
      submitQuery(searchQuery);
    },
    [searchQuery, submitQuery]
  );

  const handleFocus = () => {
    setIsDropdownOpen(true);
  };

  const handleBlur = (e: React.FocusEvent) => {
    setTimeout(() => {
      if (!e.currentTarget.contains(document.activeElement as Node)) {
        setIsDropdownOpen(false);
      }
    }, 100);
  };

  const handleApply = useCallback(
    (result: any) => {
      if (!result) {
        return;
      }

      const {
        query,
        visualization,
        group_by: groupBy,
        sort,
        stats_period: statsPeriod,
      } = result;

      const selection = {
        ...pageFilters.selection,
        datetime: {
          start: pageFilters.selection.datetime.start,
          end: pageFilters.selection.datetime.end,
          period: statsPeriod,
          utc: pageFilters.selection.datetime.utc,
        },
      };
      const mode = groupBy.length > 0 ? Mode.AGGREGATE : Mode.SAMPLES;

      const visualize =
        visualization?.map((v: Visualization) => ({
          chartType: v.chart_type,
          yAxes: v.y_axes,
        })) ?? [];

      const url = getExploreUrl({
        organization,
        selection,
        query,
        visualize,
        groupBy,
        sort,
        mode,
      });

      trackAnalytics('trace.explorer.ai_query_applied', {
        organization,
        query,
        visualize_count: visualize.length,
        group_by_count: groupBy?.length ?? 0,
      });

      navigate(url, {replace: true, preventScrollReset: true});
      setIsDropdownOpen(false);
      setSeerMode(false);
    },
    [organization, pageFilters.selection, navigate, setSeerMode]
  );

  const handleNoneOfTheseClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (openForm) {
      openForm({
        messagePlaceholder: t('Why was this query incorrect?'),
        tags: {
          ['feedback.source']: 'trace_explorer_ai_query',
          ['feedback.owner']: 'ml-ai',
          ['feedback.natural_language_query']: searchQuery,
          ['feedback.raw_result']: JSON.stringify(rawResult).replace(/\n/g, ''),
        },
      });
    } else {
      addErrorMessage(t('Unable to open feedback form'));
    }
  };

  return (
    <SeerContainer onBlur={handleBlur}>
      <SearchForm onSubmit={handleSubmit}>
        <SearchInputContainer>
          <PositionedSearchIconContainer>
            <SearchIcon size="sm" />
          </PositionedSearchIconContainer>
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
              onClick={() => setSeerMode(false)}
              aria-label={t('Close Seer search')}
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
              {rawResult.queries.map((query: any, index: number) => (
                <QueryResultItem
                  key={index}
                  onClick={e => {
                    e.preventDefault();
                    e.stopPropagation();
                    handleApply(query);
                  }}
                  role="button"
                  tabIndex={0}
                  style={{cursor: 'pointer'}}
                >
                  <QueryTokens result={query} />
                </QueryResultItem>
              ))}
              <NoneOfTheseItem onClick={handleNoneOfTheseClick}>
                {t('None of these')}
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
                      ['feedback.source']: 'seer_search',
                      ['feedback.owner']: 'issues',
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
  width: 100%;
`;

const SearchForm = styled('form')`
  width: 100%;
`;

const SearchInputContainer = styled('div')`
  position: relative;
  width: 100%;
`;

const SearchInput = styled(Input)<{isDropdownOpen: boolean}>`
  font-size: ${p => p.theme.fontSizeMedium};
  padding: ${space(1.5)} ${space(2)};
  padding-left: ${space(4)};
  border-bottom-left-radius: ${p => (p.isDropdownOpen ? '0' : p.theme.borderRadius)};
  border-bottom-right-radius: ${p => (p.isDropdownOpen ? '0' : p.theme.borderRadius)};

  &::placeholder {
    color: ${p => p.theme.subText};
  }
`;

const DropdownContent = styled('div')`
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
  z-index: ${p => p.theme.zIndex.dropdown};
  background: ${p => p.theme.background};
  border: 1px solid ${p => p.theme.border};
  border-top: none;
  border-radius: ${p => p.theme.borderRadius};
  border-top-left-radius: 0;
  border-top-right-radius: 0;
  box-shadow: ${p => p.theme.dropShadowHeavy};
  display: flex;
  flex-direction: column;
  min-height: 300px;
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
  background: ${p => p.theme.purple100};
`;

const SearchIcon = styled(IconSearch)`
  color: ${p => p.theme.subText};
  height: 22px;
`;

const PositionedSearchIconContainer = styled('div')`
  position: absolute;
  left: ${space(1.5)};
  top: 50%;
  transform: translateY(-50%);
  z-index: 1;
  pointer-events: none;
  display: flex;
  align-items: center;
  height: 100%;
`;

const PositionedCloseButtonContainer = styled('div')`
  position: absolute;
  right: ${space(1)};
  top: 50%;
  transform: translateY(-50%);
  z-index: 1;
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
  padding: ${space(2)};
  width: 100%;
`;

const QueryResultsTitle = styled('h3')`
  font-size: ${p => p.theme.fontSizeMedium};
  font-weight: ${p => p.theme.fontWeightNormal};
  color: ${p => p.theme.textColor};
  margin: 0;
`;

const StyledIconSeer = styled(SeerIcon)`
  color: ${p => p.theme.purple300};
`;

const StyledSeerLoadingIcon = styled(SeerLoadingIcon)`
  color: ${p => p.theme.purple300};
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
  padding: ${space(2)};
  border-bottom: 1px solid ${p => p.theme.border};
  transition: background-color 0.2s ease;
  user-select: none;
  position: relative;
  z-index: 1;

  &:hover {
    background-color: ${p => p.theme.backgroundSecondary};
  }

  &:last-child {
    border-bottom: none;
  }
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
