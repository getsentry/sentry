import FeatureBadge from 'sentry/components/badge/featureBadge';
import * as Layout from 'sentry/components/layouts/thirds';
import PageFiltersContainer from 'sentry/components/organizations/pageFilters/container';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {t} from 'sentry/locale';
import useOrganization from 'sentry/utils/useOrganization';
import {LogsPageParamsProvider} from 'sentry/views/explore/contexts/logs/logsPageParams';
import {LogsTabContent} from 'sentry/views/explore/logs/logsTab';
import {limitMaxPickableDays} from 'sentry/views/explore/utils';

export default function LogsPage() {
  const organization = useOrganization();
  const {defaultPeriod, maxPickableDays, relativeOptions} =
    limitMaxPickableDays(organization);

  return (
    <SentryDocumentTitle title={t('Logs')} orgSlug={organization?.slug}>
      <PageFiltersContainer maxPickableDays={maxPickableDays}>
        <Layout.Page>
          <Layout.Header>
            <Layout.HeaderContent>
              <Layout.Title>
                {t('Logs')}
                <FeatureBadge type="experimental" />
              </Layout.Title>
            </Layout.HeaderContent>
          </Layout.Header>
          <LogsPageParamsProvider>
            <LogsTabContent
              defaultPeriod={defaultPeriod}
              maxPickableDays={maxPickableDays}
              relativeOptions={relativeOptions}
            />
          </LogsPageParamsProvider>
        </Layout.Page>
      </PageFiltersContainer>
    </SentryDocumentTitle>
  );
}
