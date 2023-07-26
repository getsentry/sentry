import * as Layout from 'sentry/components/layouts/thirds';
import {
  PageErrorAlert,
  PageErrorProvider,
} from 'sentry/utils/performance/contexts/pageError';
import {StarfishPageFiltersContainer} from 'sentry/views/starfish/components/starfishPageFiltersContainer';

function DefinitionsView() {
  return (
    <Layout.Page>
      <StarfishPageFiltersContainer>
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
      </StarfishPageFiltersContainer>
    </Layout.Page>
  );
}

export default DefinitionsView;
