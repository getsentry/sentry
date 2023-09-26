import {browserHistory} from 'react-router';
import styled from '@emotion/styled';

import Alert from 'sentry/components/alert';
import DatePageFilter from 'sentry/components/datePageFilter';
import EnvironmentPageFilter from 'sentry/components/environmentPageFilter';
import * as Layout from 'sentry/components/layouts/thirds';
import PageFilterBar from 'sentry/components/organizations/pageFilterBar';
import PageFiltersContainer from 'sentry/components/organizations/pageFilters/container';
import {PageHeadingQuestionTooltip} from 'sentry/components/pageHeadingQuestionTooltip';
import Pagination from 'sentry/components/pagination';
import ProjectPageFilter from 'sentry/components/projectPageFilter';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import useDeadRageSelectors from 'sentry/utils/replays/hooks/useDeadRageSelectors';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import SelectorTable from 'sentry/views/replays/deadRageClick/selectorTable';

export default function RageClickList() {
  const organization = useOrganization();
  const location = useLocation();
  const hasRageClickFeature = organization.features.includes(
    'session-replay-rage-dead-selectors'
  );

  const {isLoading, isError, data, pageLinks} = useDeadRageSelectors({
    per_page: 50,
    sort: '-count_rage_clicks',
    cursor: location.query.cursor,
    prefix: '',
  });

  if (!hasRageClickFeature) {
    return (
      <Layout.Page withPadding>
        <Alert type="warning">{t("You don't have access to this feature")}</Alert>
      </Layout.Page>
    );
  }

  return (
    <SentryDocumentTitle
      title={t('Top Selectors with Rage Clicks')}
      orgSlug={organization.slug}
    >
      <Layout.Header>
        <Layout.HeaderContent>
          <Layout.Title>
            {t('Top Selectors with Rage Clicks')}
            <PageHeadingQuestionTooltip
              title={t('See the top selectors your users have rage clicked on.')}
              docsUrl="https://docs.sentry.io/product/session-replay/replay-page-and-filters/"
            />
          </Layout.Title>
        </Layout.HeaderContent>
      </Layout.Header>
      <PageFiltersContainer>
        <Layout.Body>
          <Layout.Main fullWidth>
            <PageFilterBar condensed>
              <ProjectPageFilter resetParamsOnChange={['cursor']} />
              <EnvironmentPageFilter resetParamsOnChange={['cursor']} />
              <DatePageFilter alignDropdown="left" resetParamsOnChange={['cursor']} />
            </PageFilterBar>
            <LayoutGap>
              <SelectorTable
                data={data}
                isError={isError}
                isLoading={isLoading}
                location={location}
                clickCountColumn={{key: 'count_rage_clicks', name: 'rage clicks'}}
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
  display: grid;
  gap: ${space(1)};
`;

const PaginationNoMargin = styled(Pagination)`
  margin: 0;
`;
