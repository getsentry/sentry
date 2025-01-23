import {useCallback} from 'react';

import Feature from 'sentry/components/acl/feature';
import FeatureBadge from 'sentry/components/badge/featureBadge';
import {Button} from 'sentry/components/button';
import ButtonBar from 'sentry/components/buttonBar';
import FeedbackWidgetButton from 'sentry/components/feedback/widget/feedbackWidgetButton';
import * as Layout from 'sentry/components/layouts/thirds';
import PageFiltersContainer from 'sentry/components/organizations/pageFilters/container';
import {PageHeadingQuestionTooltip} from 'sentry/components/pageHeadingQuestionTooltip';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {t} from 'sentry/locale';
import {decodeScalar} from 'sentry/utils/queryString';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
import useOrganization from 'sentry/utils/useOrganization';
import {LogsTabContent} from 'sentry/views/explore/logs/logsTab';
import {SpansTabContent} from 'sentry/views/explore/spans/spansTab';
import TraceExplorerTabs from 'sentry/views/explore/tabBar';
import {limitMaxPickableDays} from 'sentry/views/explore/utils';

export function ExploreContent() {
  const organization = useOrganization();
  const {defaultPeriod, maxPickableDays, relativeOptions} = limitMaxPickableDays(
    organization!
  );

  const location = useLocation();
  const navigate = useNavigate();
  const switchToOldTraceExplorer = useCallback(() => {
    navigate({
      ...location,
      query: {
        ...location.query,
        view: 'trace',
      },
    });
  }, [location, navigate]);
  const ourlogsEnabled = organization.features.includes('ourlogs-enabled');
  const selectedTab = decodeScalar(location.query.exploreTab, 'spans');

  return (
    <SentryDocumentTitle title={t('Traces')} orgSlug={organization?.slug}>
      <PageFiltersContainer maxPickableDays={maxPickableDays}>
        <Layout.Page>
          <Layout.Header>
            <Layout.HeaderContent>
              <Layout.Title>
                {t('Traces')}
                <PageHeadingQuestionTooltip
                  docsUrl="https://github.com/getsentry/sentry/discussions/81239"
                  title={t(
                    'Find problematic spans/traces or compute real-time metrics via aggregation.'
                  )}
                  linkLabel={t('Read the Discussion')}
                />
                <FeatureBadge
                  title={t(
                    'This feature is available for early adopters and the UX may change'
                  )}
                  type="beta"
                />
              </Layout.Title>
            </Layout.HeaderContent>
            <Layout.HeaderActions>
              <ButtonBar gap={1}>
                <Feature organization={organization} features="visibility-explore-admin">
                  <Button onClick={switchToOldTraceExplorer} size="sm">
                    {t('Switch to Old Trace Explore')}
                  </Button>
                </Feature>
                <FeedbackWidgetButton />
              </ButtonBar>
            </Layout.HeaderActions>
            {ourlogsEnabled ? <TraceExplorerTabs selected={selectedTab} /> : null}
          </Layout.Header>
          {ourlogsEnabled && selectedTab === 'logs' ? (
            <LogsTabContent />
          ) : (
            <SpansTabContent
              defaultPeriod={defaultPeriod}
              maxPickableDays={maxPickableDays}
              relativeOptions={relativeOptions}
            />
          )}
        </Layout.Page>
      </PageFiltersContainer>
    </SentryDocumentTitle>
  );
}
