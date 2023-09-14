import * as Layout from 'sentry/components/layouts/thirds';
import PageFiltersContainer from 'sentry/components/organizations/pageFilters/container';
import {PageHeadingQuestionTooltip} from 'sentry/components/pageHeadingQuestionTooltip';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {t} from 'sentry/locale';
import useOrganization from 'sentry/utils/useOrganization';

export default function DeadClickList() {
  const organization = useOrganization();
  const hasDeadCicks = organization.features.includes(
    'session-replay-rage-dead-selectors'
  );

  return hasDeadCicks ? (
    <SentryDocumentTitle title={`Top Selectors with Dead Clicks — ${organization.slug}`}>
      <Layout.Header>
        <Layout.HeaderContent>
          <Layout.Title>
            {t('Top Selectors with Dead Clicks')}
            <PageHeadingQuestionTooltip
              title={t('See the top selectors your users have dead clicked on.')}
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
