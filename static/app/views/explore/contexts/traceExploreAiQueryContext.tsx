import type React from 'react';
import {
  createContext,
  Fragment,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react';
import styled from '@emotion/styled';

import {addErrorMessage} from 'sentry/actionCreators/indicator';
import {Button} from 'sentry/components/core/button';
import {InputGroup} from 'sentry/components/core/input/inputGroup';
import useDrawer from 'sentry/components/globalDrawer';
import {DrawerBody, DrawerHeader} from 'sentry/components/globalDrawer/components';
import LoadingContainer from 'sentry/components/loading/loadingContainer';
// import {SearchInput} from 'sentry/components/events/eventDrawer';
import {ProvidedFormattedQuery} from 'sentry/components/searchQueryBuilder/formattedQuery';
import {parseQueryBuilderValue} from 'sentry/components/searchQueryBuilder/utils';
import {IconSearch} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {trackAnalytics} from 'sentry/utils/analytics';
import {browserHistory} from 'sentry/utils/browserHistory';
import {getFieldDefinition} from 'sentry/utils/fields';
import useApi from 'sentry/utils/useApi';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';
import {getExploreUrl} from 'sentry/views/explore/utils';
// import {HeaderContainer} from 'sentry/views/insights/common/components/headerContainer';

interface TraceExploreAiQueryContextValue {
  onAiButtonClick: () => void;
}

const AI_QUERY_DRAWER_WIDTH = '350px';

const TraceExploreAiQueryContext = createContext<
  TraceExploreAiQueryContextValue | undefined
>(undefined);

interface Visualization {
  chart_type: number;
  y_axes: string[];
}

function formatQueryTokens(result: any) {
  const tokens = [];

  const parsedQuery = parseQueryBuilderValue(result.query, getFieldDefinition);
  if (result.query) {
    tokens.push(
      <Token key="filter">
        <ExploreParamTitle>{t('Filter')}</ExploreParamTitle>
      </Token>
    );
    parsedQuery
      ?.filter(({text}) => text.trim() !== '')
      .forEach(({text}, index) => {
        tokens.push(
          <Token key={`filter-${index}`}>
            <FormattedQueryWrapper>
              <ProvidedFormattedQuery query={text} />
            </FormattedQueryWrapper>
          </Token>
        );
      });
  }

  if (result.visualization && result.visualization.length > 0) {
    tokens.push(
      <Token key="visualization">
        <ExploreParamTitle>{t('Visualization')}</ExploreParamTitle>
      </Token>
    );
    result.visualization.forEach((visualization: any) => {
      visualization.y_axes.forEach((y_axis: string, index: number) => {
        tokens.push(
          <Token key={`visualization-${index}`}>
            <ExploreVisualizes key={y_axis}>{y_axis}</ExploreVisualizes>
          </Token>
        );
      });
    });
  }

  if (result.group_by && result.group_by.length > 0) {
    tokens.push(
      <Token key="groupBy">
        <ExploreParamTitle>{t('Group By')}</ExploreParamTitle>
      </Token>
    );
    result.group_by.forEach((groupBy: string, index: number) => {
      tokens.push(
        <Token key={`groupBy-${index}`}>
          <ExploreGroupBys key={groupBy}>{groupBy}</ExploreGroupBys>
        </Token>
      );
    });
  }

  return tokens;
}

export function AiQueryDrawer() {
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [response, setResponse] = useState<React.ReactNode>(null);
  const [rawResult, setRawResult] = useState<any>(null);
  const api = useApi();
  const organization = useOrganization();
  const pageFilters = usePageFilters();
  const {closeDrawer} = useDrawer();

  const handleApply = useCallback(() => {
    if (!rawResult) {
      return;
    }

    const {query, visualization, group_by: groupBy, sort} = rawResult;

    const visualize =
      visualization?.map((v: Visualization) => ({
        chartType: v.chart_type,
        yAxes: v.y_axes,
      })) ?? [];

    const url = getExploreUrl({
      organization,
      selection: pageFilters.selection,
      query,
      visualize,
      groupBy,
      sort,
    });

    trackAnalytics('trace.explorer.ai_query_applied', {
      organization,
      query,
      visualize_count: visualize.length,
      group_by_count: groupBy?.length ?? 0,
    });

    browserHistory.push(url);
    closeDrawer();
  }, [rawResult, organization, pageFilters.selection, closeDrawer]);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!searchQuery.trim()) {
        return;
      }

      setIsLoading(true);
      try {
        setIsLoading(true);
        const result = await api.requestPromise(
          `/${organization.slug}/trace-explorer-ai/query/`,
          {
            method: 'POST',
            data: {
              natural_language_query: searchQuery,
              project_ids: pageFilters.selection.projects,
            },
          }
        );
        const query_tokens = formatQueryTokens(result);
        setResponse(query_tokens);
        setRawResult(result);
      } catch (error) {
        // TODO: Remove this once we have a real result
        const dummy_result = {
          status: 'ok',
          query: 'span.op:function',
          stats_period: '7h',
          group_by: ['project', 'http.response_code'],
          visualization: [
            {chart_type: 1, y_axes: ['count']},
            {chart_type: 3, y_axes: ['avg(span.duration)']},
          ],
          sort: '-timestamp',
        };
        const query_tokens = formatQueryTokens(dummy_result);
        setResponse(query_tokens);
        setRawResult(dummy_result);
        addErrorMessage(t('Failed to process AI query: %(error)s', {error}));
      } finally {
        setIsLoading(false);
      }
    },
    [api, organization.slug, pageFilters.selection.projects, searchQuery]
  );

  return (
    <DrawerContainer>
      <DrawerHeader hideBar />
      <StyledDrawerBody>
        <HeaderContainer>
          <AiQueryHeader>{t('Seer Says...')}</AiQueryHeader>
          {/* <Text>{t('Enter your query')}</Text> */}
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
                disabled={isLoading}
              />
            </StyledInputGroup>
          </form>
          {isLoading && <LoadingContainer>Loading...</LoadingContainer>}
          {response && (
            <Fragment>
              <div>
                <ExploreParamsContainer>{response}</ExploreParamsContainer>
              </div>
              <div>
                <Button onClick={handleApply}>Apply</Button>
                <Button onClick={() => {}}>Wrong</Button>
              </div>
            </Fragment>
          )}
        </HeaderContainer>
      </StyledDrawerBody>
    </DrawerContainer>
  );
}

export function TraceExploreAiQueryContextProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const organization = useOrganization();
  const {openDrawer} = useDrawer();
  const pageFilters = usePageFilters();
  const client = useApi();

  useEffect(() => {
    if (organization.features.includes('organizations:gen-ai-explore-traces')) {
      client.request(`/api/0/${organization.slug}/trace-explorer-ai-setup/`, {
        method: 'POST',
        data: {
          org_id: organization.id,
          project_ids: pageFilters.selection.projects,
        },
      });
    }
  }, [
    client,
    organization.features,
    organization.id,
    organization.slug,
    pageFilters.selection.projects,
  ]);

  return (
    <TraceExploreAiQueryContext.Provider
      value={{
        onAiButtonClick: () => {
          openDrawer(() => <AiQueryDrawer />, {
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

export const useTraceExploreAiQueryContext = () => {
  return useContext(TraceExploreAiQueryContext);
};

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
  @media (max-width: ${p => p.theme.breakpoints.medium}) {
    max-width: 175px;
  }
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

// const ResponseContainer = styled('div')`
//   margin-top: ${space(2)};
//   padding: ${space(1)};
//   background: ${p => p.theme.backgroundSecondary};
//   border-radius: ${p => p.theme.borderRadius};
//   overflow: auto;

//   pre {
//     margin: 0;
//     white-space: pre-wrap;
//     word-break: break-word;
//   }
// `;

const ExploreParamsContainer = styled('span')`
  display: flex;
  flex-direction: row;
  gap: ${space(1)};
  flex-wrap: wrap;
  margin-bottom: ${space(2)};
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
