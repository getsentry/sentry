import {useCallback, useState} from 'react';
import styled from '@emotion/styled';
import type {Location} from 'history';

import Feature from 'sentry/components/acl/feature';
import {Alert} from 'sentry/components/alert';
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
import {useUserQuery} from 'sentry/views/explore/hooks/useUserQuery';
import {ExploreTables} from 'sentry/views/explore/tables';
import {ExploreToolbar} from 'sentry/views/explore/toolbar';

import {useResultMode} from './hooks/useResultsMode';

interface ExploreContentProps {
  location: Location;
}

function ExploreContentImpl({}: ExploreContentProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const organization = useOrganization();
  const {selection} = usePageFilters();
  const [dataset] = useDataset();

  const [resultMode] = useResultMode();
  const supportedAggregates =
    resultMode === 'aggregate' ? ALLOWED_EXPLORE_VISUALIZE_AGGREGATES : [];

  const numberTags = useSpanTags('number');
  const stringTags = useSpanTags('string');

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

  const [chartError, setChartError] = useState<string>('');
  const [tableError, setTableError] = useState<string>('');

  return (
    <SentryDocumentTitle title={t('Traces')} orgSlug={organization.slug}>
      <PageFiltersContainer>
        <Layout.Page>
          <Layout.Header>
            <Layout.HeaderContent>
              <Layout.Title>{t('Traces')}</Layout.Title>
            </Layout.HeaderContent>
            <Layout.HeaderActions>
              <ButtonBar gap={1}>
                <Feature organization={organization} features="visibility-explore-admin">
                  <Button onClick={switchToOldTraceExplorer} size="sm">
                    {t('Switch to Old Trace Explore')}
                  </Button>
                </Feature>
                <FeedbackWidgetButton />
              </ButtonBar>
            </Layout.HeaderActions>
          </Layout.Header>
          <Body>
            <TopSection>
              <StyledPageFilterBar condensed>
                <ProjectPageFilter />
                <EnvironmentPageFilter />
                <DatePageFilter
                  maxPickableDays={7}
                  relativeOptions={({arbitraryOptions}) => ({
                    ...arbitraryOptions,
                    '1h': t('Last 1 hour'),
                    '24h': t('Last 24 hours'),
                    '7d': t('Last 7 days'),
                  })}
                />
              </StyledPageFilterBar>
              {dataset === DiscoverDatasets.SPANS_INDEXED ? (
                <SpanSearchQueryBuilder
                  projects={selection.projects}
                  initialQuery={userQuery}
                  onSearch={setUserQuery}
                  searchSource="explore"
                />
              ) : (
                <EAPSpanSearchQueryBuilder
                  projects={selection.projects}
                  initialQuery={userQuery}
                  onSearch={setUserQuery}
                  searchSource="explore"
                  supportedAggregates={supportedAggregates}
                  numberTags={numberTags}
                  stringTags={stringTags}
                />
              )}
            </TopSection>
            <ExploreToolbar extras={toolbarExtras} />
            <MainSection fullWidth>
              {(tableError || chartError) && (
                <Alert type="error" showIcon>
                  {tableError || chartError}
                </Alert>
              )}
              <ExploreCharts query={userQuery} setError={setChartError} />
              <ExploreTables setError={setTableError} />
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
    <SpanTagsProvider dataset={dataset} enabled>
      <ExploreContentImpl {...props} />
    </SpanTagsProvider>
  );
}

const Body = styled(Layout.Body)`
  gap: ${space(2)};

  @media (min-width: ${p => p.theme.breakpoints.medium}) {
    grid-template-columns: 350px minmax(100px, auto);
    gap: ${space(2)};
  }

  @media (min-width: ${p => p.theme.breakpoints.xxlarge}) {
    grid-template-columns: 400px minmax(100px, auto);
  }
`;

const TopSection = styled('div')`
  display: grid;
  gap: ${space(2)};
  grid-column: 1/3;
  margin-bottom: ${space(2)};

  @media (min-width: ${p => p.theme.breakpoints.large}) {
    grid-template-columns: minmax(350px, auto) 1fr;
    margin-bottom: 0;
  }

  @media (min-width: ${p => p.theme.breakpoints.xxlarge}) {
    grid-template-columns: minmax(400px, auto) 1fr;
  }
`;

const MainSection = styled(Layout.Main)`
  grid-column: 2/3;
`;

const StyledPageFilterBar = styled(PageFilterBar)`
  width: auto;
`;
