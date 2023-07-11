import * as Layout from 'sentry/components/layouts/thirds';
import PageFiltersContainer from 'sentry/components/organizations/pageFilters/container';
import {
  PageErrorAlert,
  PageErrorProvider,
} from 'sentry/utils/performance/contexts/pageError';

function DefinitionsView() {
  return (
    <Layout.Page>
      <PageFiltersContainer>
        <PageErrorProvider>
          <Layout.Header>
            <Layout.HeaderContent>
              <Layout.Title> Defintions </Layout.Title>
            </Layout.HeaderContent>
          </Layout.Header>
          <Layout.Body>
            <Layout.Main fullWidth>
              <PageErrorAlert />
              <ul>
                <li>
                  Time Spent - time spent is calculated by dividing the total span time by
                  the total app time.
                </li>
              </ul>
            </Layout.Main>
          </Layout.Body>
        </PageErrorProvider>
      </PageFiltersContainer>
    </Layout.Page>
  );
}

export default DefinitionsView;
