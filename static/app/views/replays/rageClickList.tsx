import * as Layout from 'sentry/components/layouts/thirds';
import PageFiltersContainer from 'sentry/components/organizations/pageFilters/container';
import {PageHeadingQuestionTooltip} from 'sentry/components/pageHeadingQuestionTooltip';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {t} from 'sentry/locale';
import useOrganization from 'sentry/utils/useOrganization';

export default function RageClickList() {
  const organization = useOrganization();
  const hasRageCicks = organization.features.includes(
    'session-replay-rage-dead-selectors'
  );

  return hasRageCicks ? (
    <SentryDocumentTitle title={`Top Selectors with Rage Clicks — ${organization.slug}`}>
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
          <Layout.Main fullWidth>TODO</Layout.Main>
        </Layout.Body>
      </PageFiltersContainer>
    </SentryDocumentTitle>
  ) : null;
}
