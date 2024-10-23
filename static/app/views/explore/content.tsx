import {useCallback, useMemo} from 'react';
import styled from '@emotion/styled';
import type {Location} from 'history';

import {Button} from 'sentry/components/button';
import ButtonBar from 'sentry/components/buttonBar';
import FeedbackWidgetButton from 'sentry/components/feedback/widget/feedbackWidgetButton';
import * as Layout from 'sentry/components/layouts/thirds';
import {DatePageFilter} from 'sentry/components/organizations/datePageFilter';
import {EnvironmentPageFilter} from 'sentry/components/organizations/environmentPageFilter';
import PageFilterBar from 'sentry/components/organizations/pageFilterBar';
import PageFiltersContainer from 'sentry/components/organizations/pageFilters/container';
import {ProjectPageFilter} from 'sentry/components/organizations/projectPageFilter';
import {
  EAPSpanSearchQueryBuilder,
  SpanSearchQueryBuilder,
} from 'sentry/components/performance/spanSearchQueryBuilder';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {DiscoverDatasets} from 'sentry/utils/discover/types';
import {ALLOWED_EXPLORE_VISUALIZE_AGGREGATES} from 'sentry/utils/fields';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';
import {ExploreCharts} from 'sentry/views/explore/charts';
import {
  SpanTagsProvider,
  useSpanTags,
} from 'sentry/views/explore/contexts/spanTagsContext';
import {useDataset} from 'sentry/views/explore/hooks/useDataset';
import {useResultMode} from 'sentry/views/explore/hooks/useResultsMode';
import {useUserQuery} from 'sentry/views/explore/hooks/useUserQuery';
import {ExploreTables} from 'sentry/views/explore/tables';
import {ExploreToolbar} from 'sentry/views/explore/toolbar';

interface ExploreContentProps {
  location: Location;
}

function ExploreContentImpl({}: ExploreContentProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const organization = useOrganization();
  const {selection} = usePageFilters();
  const [dataset] = useDataset();
  const [resultsMode] = useResultMode();

  const numberTags = useSpanTags('number');
  const stringTags = useSpanTags('string');

  const supportedAggregates = useMemo(() => {
    return resultsMode === 'aggregate' ? ALLOWED_EXPLORE_VISUALIZE_AGGREGATES : [];
  }, [resultsMode]);

  const [userQuery, setUserQuery] = useUserQuery();

  const toolbarExtras = organization.features.includes('visibility-explore-dataset')
    ? ['dataset toggle' as const]
    : [];

  const switchToOldTraceExplorer = useCallback(() => {
    navigate({
      ...location,
      query: {
        ...location.query,
        view: 'trace',
      },
    });
  }, [location, navigate]);

  return (
    <SentryDocumentTitle title={t('Explore')} orgSlug={organization.slug}>
      <PageFiltersContainer>
        <Layout.Page>
          <Layout.Header>
            <Layout.HeaderContent>
              <Layout.Title>{t('Explore')}</Layout.Title>
            </Layout.HeaderContent>
            <Layout.HeaderActions>
              <ButtonBar gap={1}>
                <Button onClick={switchToOldTraceExplorer} size="sm">
                  {t('Switch to Old Trace Explore')}
                </Button>
                <FeedbackWidgetButton />
              </ButtonBar>
            </Layout.HeaderActions>
          </Layout.Header>
          <Body>
            <TopSection>
              <StyledPageFilterBar condensed>
                <ProjectPageFilter />
                <EnvironmentPageFilter />
                <DatePageFilter />
              </StyledPageFilterBar>
              {dataset === DiscoverDatasets.SPANS_INDEXED ? (
                <SpanSearchQueryBuilder
                  supportedAggregates={supportedAggregates}
                  projects={selection.projects}
                  initialQuery={userQuery}
                  onSearch={setUserQuery}
                  searchSource="explore"
                />
              ) : (
                <EAPSpanSearchQueryBuilder
                  supportedAggregates={supportedAggregates}
                  projects={selection.projects}
                  initialQuery={userQuery}
                  onSearch={setUserQuery}
                  searchSource="explore"
                  numberTags={numberTags}
                  stringTags={stringTags}
                />
              )}
            </TopSection>
            <ExploreToolbar extras={toolbarExtras} />
            <MainSection fullWidth>
              <ExploreCharts query={userQuery} />
              <ExploreTables />
            </MainSection>
          </Body>
        </Layout.Page>
      </PageFiltersContainer>
    </SentryDocumentTitle>
  );
}

export function ExploreContent(props: ExploreContentProps) {
  const [dataset] = useDataset();

  return (
    <SpanTagsProvider dataset={dataset}>
      <ExploreContentImpl {...props} />
    </SpanTagsProvider>
  );
}

const Body = styled(Layout.Body)`
  gap: ${space(2)};

  @media (min-width: ${p => p.theme.breakpoints.medium}) {
    grid-template-columns: 300px minmax(100px, auto);
  }

  @media (min-width: ${p => p.theme.breakpoints.xlarge}) {
    grid-template-columns: 350px minmax(100px, auto);
  }
`;

const TopSection = styled('div')`
  display: grid;
  gap: ${space(2)};
  grid-column: 1/3;
  margin-bottom: ${space(2)};

  @media (min-width: ${p => p.theme.breakpoints.large}) {
    grid-template-columns: minmax(300px, auto) 1fr;
    margin-bottom: 0;
  }

  @media (min-width: ${p => p.theme.breakpoints.xlarge}) {
    grid-template-columns: minmax(350px, auto) 1fr;
  }
`;

const MainSection = styled(Layout.Main)`
  grid-column: 2/3;
`;

const StyledPageFilterBar = styled(PageFilterBar)`
  width: auto;
`;
