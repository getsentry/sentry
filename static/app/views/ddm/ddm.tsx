import ButtonBar from 'sentry/components/buttonBar';
import FeatureBadge from 'sentry/components/featureBadge';
import {FeatureFeedback} from 'sentry/components/featureFeedback';
import * as Layout from 'sentry/components/layouts/thirds';
import PageFiltersContainer from 'sentry/components/organizations/pageFilters/container';
import {PageHeadingQuestionTooltip} from 'sentry/components/pageHeadingQuestionTooltip';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {t} from 'sentry/locale';
import useOrganization from 'sentry/utils/useOrganization';
import MetricsExplorer from 'sentry/views/ddm/metricsExplorer';

function DDM() {
  const organization = useOrganization();

  return (
    <SentryDocumentTitle title={t('DDM')} orgSlug={organization.slug}>
      <PageFiltersContainer>
        <Layout.Page>
          <Layout.Header>
            <Layout.HeaderContent>
              <Layout.Title>
                {t('DDM')}
                <PageHeadingQuestionTooltip
                  docsUrl="https://docs.sentry.io"
                  title={t('Delightful Developer Metrics.')}
                />
                <FeatureBadge type="alpha" />
              </Layout.Title>
            </Layout.HeaderContent>
            <Layout.HeaderActions>
              <ButtonBar gap={1}>
                <FeatureFeedback featureName="DDM" buttonProps={{size: 'sm'}} />
              </ButtonBar>
            </Layout.HeaderActions>
          </Layout.Header>
          <Layout.Body>
            <Layout.Main fullWidth>
              <MetricsExplorer />
            </Layout.Main>
          </Layout.Body>
        </Layout.Page>
      </PageFiltersContainer>
    </SentryDocumentTitle>
  );
}

export default DDM;
