import {browserHistory} from 'react-router';
import styled from '@emotion/styled';

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
import {space} from 'sentry/styles/space';
import useDeadRageSelectors from 'sentry/utils/replays/hooks/useDeadRageSelectors';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import SelectorTable from 'sentry/views/replays/deadRageClick/selectorTable';
import ReplayTabs from 'sentry/views/replays/tabs';

export default function DeadRageClickList() {
  const organization = useOrganization();
  const location = useLocation();

  const {isLoading, isError, data, pageLinks} = useDeadRageSelectors({
    per_page: 50,
    sort: '-count_dead_clicks',
    cursor: location.query.cursor,
    prefix: '',
    isWidgetData: false,
  });

  return (
    <SentryDocumentTitle
      title={t('Top Selectors with Dead Clicks')}
      orgSlug={organization.slug}
    >
      <Layout.Header>
        <Layout.HeaderContent>
          <Layout.Title>
            {t('Top Selectors with Dead and Rage Clicks')}
            <PageHeadingQuestionTooltip
              title={t('See the top selectors your users have dead and rage clicked on.')}
              docsUrl="https://docs.sentry.io/product/session-replay/replay-page-and-filters/"
            />
          </Layout.Title>
        </Layout.HeaderContent>
        <div /> {/* wraps the tabs below the page title */}
        <ReplayTabs selected="selectors" />
      </Layout.Header>
      <PageFiltersContainer>
        <Layout.Body>
          <Layout.Main fullWidth>
            <PageFilterBar condensed>
              <ProjectPageFilter resetParamsOnChange={['cursor']} />
              <EnvironmentPageFilter resetParamsOnChange={['cursor']} />
              <DatePageFilter resetParamsOnChange={['cursor']} />
            </PageFilterBar>
            <LayoutGap>
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
            </LayoutGap>
            <PaginationNoMargin
              pageLinks={pageLinks}
              onCursor={(cursor, path, searchQuery) => {
                browserHistory.push({
                  pathname: path,
                  query: {...searchQuery, cursor},
                });
              }}
            />
          </Layout.Main>
        </Layout.Body>
      </PageFiltersContainer>
    </SentryDocumentTitle>
  );
}

const LayoutGap = styled('div')`
  margin-top: ${space(2)};
`;

const PaginationNoMargin = styled(Pagination)`
  margin: 0;
`;
