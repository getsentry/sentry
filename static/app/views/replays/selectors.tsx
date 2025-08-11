import styled from '@emotion/styled';

import AnalyticsArea from 'sentry/components/analyticsArea';
import {Grid} from 'sentry/components/core/layout';
import * as Layout from 'sentry/components/layouts/thirds';
import {DatePageFilter} from 'sentry/components/organizations/datePageFilter';
import {EnvironmentPageFilter} from 'sentry/components/organizations/environmentPageFilter';
import PageFilterBar from 'sentry/components/organizations/pageFilterBar';
import PageFiltersContainer from 'sentry/components/organizations/pageFilters/container';
import {ProjectPageFilter} from 'sentry/components/organizations/projectPageFilter';
import {PageHeadingQuestionTooltip} from 'sentry/components/pageHeadingQuestionTooltip';
import Pagination from 'sentry/components/pagination';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {t} from 'sentry/locale';
import useDeadRageSelectors from 'sentry/utils/replays/hooks/useDeadRageSelectors';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
import useOrganization from 'sentry/utils/useOrganization';
import SelectorTable from 'sentry/views/replays/selectors/selectorTable';
import ReplayTabs from 'sentry/views/replays/tabs';

export default function DeadRageClickList() {
  const organization = useOrganization();
  const location = useLocation();
  const navigate = useNavigate();

  const {isLoading, isError, data, pageLinks} = useDeadRageSelectors({
    per_page: 50,
    sort: '-count_dead_clicks',
    cursor: location.query.cursor,
    prefix: '',
    isWidgetData: false,
  });

  return (
    <AnalyticsArea name="selectors">
      <SentryDocumentTitle
        title={t('Top Selectors with Dead Clicks')}
        orgSlug={organization.slug}
      >
        <Layout.Header>
          <Layout.HeaderContent>
            <Layout.Title>
              {t('Top Selectors with Dead and Rage Clicks')}
              <PageHeadingQuestionTooltip
                title={t(
                  'See the top selectors your users have dead and rage clicked on.'
                )}
                docsUrl="https://docs.sentry.io/product/session-replay/replay-page-and-filters/"
              />
            </Layout.Title>
          </Layout.HeaderContent>
          <ReplayTabs selected="selectors" />
        </Layout.Header>
        <PageFiltersContainer>
          <Layout.Body>
            <Layout.Main fullWidth>
              <Grid gap="xl">
                <PageFilterBar condensed>
                  <ProjectPageFilter resetParamsOnChange={['cursor']} />
                  <EnvironmentPageFilter resetParamsOnChange={['cursor']} />
                  <DatePageFilter resetParamsOnChange={['cursor']} />
                </PageFilterBar>

                <SelectorTable
                  data={data}
                  isError={isError}
                  isLoading={isLoading}
                  location={location}
                  clickCountColumns={[
                    {key: 'count_dead_clicks', name: 'dead clicks'},
                    {key: 'count_rage_clicks', name: 'rage clicks'},
                  ]}
                  clickCountSortable
                />
              </Grid>
              <PaginationNoMargin
                pageLinks={pageLinks}
                onCursor={(cursor, path, searchQuery) => {
                  navigate({
                    pathname: path,
                    query: {...searchQuery, cursor},
                  });
                }}
              />
            </Layout.Main>
          </Layout.Body>
        </PageFiltersContainer>
      </SentryDocumentTitle>
    </AnalyticsArea>
  );
}

const PaginationNoMargin = styled(Pagination)`
  margin: 0;
`;
