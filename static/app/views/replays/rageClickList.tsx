import Alert from 'sentry/components/alert';
import * as Layout from 'sentry/components/layouts/thirds';
import PageFiltersContainer from 'sentry/components/organizations/pageFilters/container';
import {PageHeadingQuestionTooltip} from 'sentry/components/pageHeadingQuestionTooltip';
import Placeholder from 'sentry/components/placeholder';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {t} from 'sentry/locale';
import useDeadRageSelectors from 'sentry/utils/replays/hooks/useDeadRageSelectors';
import useOrganization from 'sentry/utils/useOrganization';

export default function RageClickList() {
  const organization = useOrganization();
  const hasRageCicks = organization.features.includes(
    'session-replay-rage-dead-selectors'
  );
  const {isLoading, isError, data} = useDeadRageSelectors({
    per_page: 3,
    sort: '-count_rage_clicks',
  });

  return hasRageCicks ? (
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
            {isLoading ? (
              <Placeholder />
            ) : isError ? (
              <Alert type="error" showIcon>
                {t('An error occurred')}
              </Alert>
            ) : (
              <pre>
                {JSON.stringify(
                  data.data.map(d => {
                    return {
                      count_rage_clicks: d.count_rage_clicks,
                      dom_element: d.dom_element,
                    };
                  }),
                  null,
                  '\t'
                )}
              </pre>
            )}
          </Layout.Main>
        </Layout.Body>
      </PageFiltersContainer>
    </SentryDocumentTitle>
  ) : (
    <Layout.Page withPadding>
      <Alert type="warning">{t("You don't have access to this feature")}</Alert>
    </Layout.Page>
  );
}
