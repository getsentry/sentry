import React, {Fragment, useCallback, useEffect, useState} from 'react';
import styled from '@emotion/styled';
import * as Sentry from '@sentry/react';

import {addErrorMessage} from 'sentry/actionCreators/indicator';
import {FeatureBadge} from 'sentry/components/core/badge/featureBadge';
import {Button} from 'sentry/components/core/button';
import {InputGroup} from 'sentry/components/core/input/inputGroup';
import useDrawer from 'sentry/components/globalDrawer';
import {DrawerBody, DrawerHeader} from 'sentry/components/globalDrawer/components';
import LoadingContainer from 'sentry/components/loading/loadingContainer';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {ProvidedFormattedQuery} from 'sentry/components/searchQueryBuilder/formattedQuery';
import {parseQueryBuilderValue} from 'sentry/components/searchQueryBuilder/utils';
import Text from 'sentry/components/text';
import {IconSearch, IconThumb} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {trackAnalytics} from 'sentry/utils/analytics';
import {getFieldDefinition} from 'sentry/utils/fields';
import {useMutation} from 'sentry/utils/queryClient';
import useApi from 'sentry/utils/useApi';
import {useFeedbackForm} from 'sentry/utils/useFeedbackForm';
import {useNavigate} from 'sentry/utils/useNavigate';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';
import useProjects from 'sentry/utils/useProjects';
import {Mode} from 'sentry/views/explore/contexts/pageParamsContext/mode';
import {TraceExploreAiQueryContext} from 'sentry/views/explore/contexts/traceExploreAiQueryContext';
import {getExploreUrl} from 'sentry/views/explore/utils';
import type {ChartType} from 'sentry/views/insights/common/components/chart';

const AI_QUERY_DRAWER_WIDTH = '350px';

interface Visualization {
  chart_type: ChartType;
  y_axes: string[];
}

interface QueryTokensProps {
  result: {
    group_by?: string[];
    query?: string;
    sort?: string;
    stats_period?: string;
    visualization?: Array<{y_axes: string[]}>;
  };
}

function QueryTokens({result}: QueryTokensProps) {
  const tokens = [];

  const parsedQuery = result.query
    ? parseQueryBuilderValue(result.query, getFieldDefinition)
    : null;
  if (result.query && parsedQuery?.length) {
    tokens.push(
      <Token key="filter">
        <ExploreParamTitle>{t('Filter')}</ExploreParamTitle>
        {parsedQuery
          .filter(({text}) => text.trim() !== '')
          .map(({text}) => (
            <FormattedQueryWrapper key={text}>
              <ProvidedFormattedQuery query={text} />
            </FormattedQueryWrapper>
          ))}
      </Token>
    );
  }

  if (result.visualization && result.visualization.length > 0) {
    tokens.push(
      <Token key="visualization">
        <ExploreParamTitle>{t('Visualization')}</ExploreParamTitle>
        {result.visualization.map((visualization, vIdx) =>
          visualization.y_axes.map(y_axis => (
            <ExploreVisualizes key={`${vIdx}-${y_axis}`}>{y_axis}</ExploreVisualizes>
          ))
        )}
      </Token>
    );
  }

  if (result.group_by && result.group_by.length > 0) {
    tokens.push(
      <Token key="groupBy">
        <ExploreParamTitle>{t('Group By')}</ExploreParamTitle>
        {result.group_by.map(groupBy => (
          <ExploreGroupBys key={groupBy}>{groupBy}</ExploreGroupBys>
        ))}
      </Token>
    );
  }

  if (result.stats_period && result.stats_period.length > 0) {
    tokens.push(
      <Token key="timeRange">
        <ExploreParamTitle>{t('Time Range')}</ExploreParamTitle>
        <ExploreGroupBys key={result.stats_period}>{result.stats_period}</ExploreGroupBys>
      </Token>
    );
  }

  if (result.sort && result.sort.length > 0) {
    tokens.push(
      <Token key="sort">
        <ExploreParamTitle>{t('Sort')}</ExploreParamTitle>
        <ExploreGroupBys key={result.sort}>
          {result.sort[0] === '-' ? result.sort.slice(1) + ' Desc' : result.sort + ' Asc'}
        </ExploreGroupBys>
      </Token>
    );
  }

  return <React.Fragment>{tokens}</React.Fragment>;
}

function AiQueryDrawer({initialQuery = ''}: {initialQuery?: string}) {
  const [searchQuery, setSearchQuery] = useState(initialQuery);
  const [response, setResponse] = useState<React.ReactNode>(null);
  const [rawResult, setRawResult] = useState<any>(null);
  const [generatedQueryString, setGeneratedQueryString] = useState<string>('');
  const api = useApi();
  const organization = useOrganization();
  const pageFilters = usePageFilters();
  const {closeDrawer} = useDrawer();
  const openFeedbackForm = useFeedbackForm();
  const navigate = useNavigate();
  const {projects} = useProjects();
  const memberProjects = projects.filter(p => p.isMember);

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
          },
        }
      );
      return result;
    },
    onSuccess: result => {
      setResponse(<QueryTokens result={result} />);
      setRawResult(result);
      setGeneratedQueryString(JSON.stringify(result));
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

  const handleApply = useCallback(() => {
    if (!rawResult) {
      return;
    }

    const {
      query,
      visualization,
      group_by: groupBy,
      sort,
      stats_period: statsPeriod,
    } = rawResult;

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
    closeDrawer();
  }, [rawResult, organization, pageFilters.selection, closeDrawer, navigate]);

  return (
    <DrawerContainer>
      <DrawerHeader hideBar />
      <StyledDrawerBody>
        <HeaderContainer>
          <StyledHeaderContainer>
            <AiQueryHeader>{t('Seer Says...')}</AiQueryHeader>
            <FeatureBadge type="alpha" />
          </StyledHeaderContainer>
          <form onSubmit={handleSubmit}>
            <StyledInputGroup>
              <InputGroup.LeadingItems disablePointerEvents>
                <IconSearch size="sm" />
              </InputGroup.LeadingItems>
              <SearchInput
                size="sm"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                aria-label={t('Natural Language Query Input')}
                placeholder={t('Enter your query')}
                autoFocus
                disabled={isPending}
              />
            </StyledInputGroup>
          </form>
          {isPending && (
            <LoadingContainer>
              <LoadingIndicator />
            </LoadingContainer>
          )}
          {response && (
            <Fragment>
              <div>
                <Text>{t('Do you want to run this query?')}</Text>
              </div>
              <StyledParamsContainer>
                <ExploreParamsContainer>{response}</ExploreParamsContainer>
              </StyledParamsContainer>
              <ButtonContainer>
                <Button
                  priority="primary"
                  icon={<IconThumb direction="up" />}
                  onClick={handleApply}
                >
                  {t('Run')}
                </Button>
                <Button
                  priority="default"
                  icon={<IconThumb direction="down" />}
                  onClick={() => {
                    if (openFeedbackForm) {
                      openFeedbackForm({
                        messagePlaceholder: t('Why was this query incorrect?'),
                        tags: {
                          ['feedback.source']: 'trace_explorer_ai_query',
                          ['feedback.owner']: 'ml-ai',
                          ['feedback.natural_language_query']: searchQuery,
                          ['feedback.generated_query']: generatedQueryString,
                        },
                      });
                    } else {
                      addErrorMessage(t('Unable to open feedback form'));
                    }
                  }}
                >
                  {t('Nope')}
                </Button>
              </ButtonContainer>
            </Fragment>
          )}
        </HeaderContainer>
      </StyledDrawerBody>
    </DrawerContainer>
  );
}

export function TraceExploreAiQueryProvider({children}: {children: React.ReactNode}) {
  const organization = useOrganization();
  const {openDrawer} = useDrawer();
  const pageFilters = usePageFilters();
  const client = useApi();
  const {projects} = useProjects();
  const memberProjects = projects.filter(p => p.isMember);

  useEffect(() => {
    const selectedProjects =
      pageFilters.selection.projects &&
      pageFilters.selection.projects.length > 0 &&
      pageFilters.selection.projects[0] !== -1
        ? pageFilters.selection.projects
        : memberProjects.map(p => p.id);

    (async () => {
      try {
        await client.requestPromise(
          `/api/0/organizations/${organization.slug}/trace-explorer-ai/setup/`,
          {
            method: 'POST',
            data: {
              org_id: organization.id,
              project_ids: selectedProjects,
            },
          }
        );
      } catch (err) {
        Sentry.captureException(err);
      }
    })();
  }, [
    client,
    organization.id,
    organization.slug,
    pageFilters.selection.projects,
    projects,
    memberProjects,
  ]);

  return (
    <TraceExploreAiQueryContext.Provider
      value={{
        onAiButtonClick: (initialQuery = '') => {
          openDrawer(() => <AiQueryDrawer initialQuery={initialQuery} />, {
            ariaLabel: t('AI Query Drawer'),
            drawerWidth: AI_QUERY_DRAWER_WIDTH,
            drawerKey: 'ai-query-drawer',
            resizable: true,
            onOpen: () => {
              trackAnalytics('trace.explorer.ai_query_drawer', {
                drawer_open: true,
                organization,
              });
            },
            onClose: () => {
              trackAnalytics('trace.explorer.ai_query_drawer', {
                drawer_open: false,
                organization,
              });
            },
          });
        },
      }}
    >
      {children}
    </TraceExploreAiQueryContext.Provider>
  );
}

const DrawerContainer = styled('div')`
  display: flex;
  flex-direction: column;
  height: 100%;

  > header {
    flex-shrink: 0;
  }
`;

const StyledDrawerBody = styled(DrawerBody)`
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
`;

const AiQueryHeader = styled('h4')`
  margin: 0;
  flex-shrink: 0;
`;

const StyledInputGroup = styled(InputGroup)`
  width: 100%;
`;

const HeaderContainer = styled('div')`
  display: flex;
  flex-direction: column;
  margin-bottom: ${space(2)};
  gap: ${space(1)};
`;

const SearchInput = styled(InputGroup.Input)`
  box-shadow: unset;
  color: inherit;
`;

const ExploreParamsContainer = styled('span')`
  display: flex;
  flex-direction: column;
  gap: ${space(1)};
  margin-top: ${space(1)};
  margin-bottom: ${space(1)};
  width: 100%;
`;

const Token = styled('span')`
  display: flex;
  flex-direction: row;
  gap: ${space(0.5)};
  overflow: hidden;
  flex-wrap: wrap;
`;

const ExploreParamTitle = styled('span')`
  font-size: ${p => p.theme.form.sm.fontSize};
  color: ${p => p.theme.subText};
  white-space: nowrap;
  padding-top: 3px;
`;

const ExploreVisualizes = styled('span')`
  font-size: ${p => p.theme.form.sm.fontSize};
  background: ${p => p.theme.background};
  padding: ${space(0.25)} ${space(0.5)};
  border: 1px solid ${p => p.theme.innerBorder};
  border-radius: ${p => p.theme.borderRadius};
  height: 24px;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
`;

const ExploreGroupBys = ExploreVisualizes;
const FormattedQueryWrapper = styled('span')`
  display: inline-block;
`;

const ButtonContainer = styled('div')`
  display: flex;
  flex-direction: row;
  gap: ${space(1)};
`;

const StyledParamsContainer = styled('div')`
  display: flex;
  flex-direction: row;
  gap: ${space(1)};
  border-top: 1px solid ${p => p.theme.border};
  border-bottom: 1px solid ${p => p.theme.border};
`;

const StyledHeaderContainer = styled('div')`
  display: flex;
  align-items: center;
  gap: ${space(1)};
`;
