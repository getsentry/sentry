import {FeatureBadge} from 'sentry/components/core/badge/featureBadge';
import {Button} from 'sentry/components/core/button';
import {ButtonBar} from 'sentry/components/core/button/buttonBar';
import * as Layout from 'sentry/components/layouts/thirds';
import PageFiltersContainer from 'sentry/components/organizations/pageFilters/container';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {IconMegaphone} from 'sentry/icons';
import {t} from 'sentry/locale';
import {defined} from 'sentry/utils';
import {LogsAnalyticsPageSource} from 'sentry/utils/analytics/logsAnalyticsEvent';
import {useFeedbackForm} from 'sentry/utils/useFeedbackForm';
import useOrganization from 'sentry/utils/useOrganization';
import ExploreBreadcrumb from 'sentry/views/explore/components/breadcrumb';
import {LogsPageDataProvider} from 'sentry/views/explore/contexts/logs/logsPageData';
import {
  LogsPageParamsProvider,
  useLogsId,
  useLogsTitle,
} from 'sentry/views/explore/contexts/logs/logsPageParams';
import {TraceItemAttributeProvider} from 'sentry/views/explore/contexts/traceItemAttributeContext';
import {LogsTabOnboarding} from 'sentry/views/explore/logs/logsOnboarding';
import {LogsQueryParamsProvider} from 'sentry/views/explore/logs/logsQueryParamsProvider';
import {LogsTabContent} from 'sentry/views/explore/logs/logsTab';
import {logsPickableDays} from 'sentry/views/explore/logs/utils';
import {TraceItemDataset} from 'sentry/views/explore/types';
import {useOnboardingProject} from 'sentry/views/insights/common/queries/useOnboardingProject';
import {usePrefersStackedNav} from 'sentry/views/nav/usePrefersStackedNav';

function FeedbackButton() {
  const openForm = useFeedbackForm();

  if (!openForm) {
    return null;
  }
  return (
    <Button
      size="xs"
      aria-label="trace-view-feedback"
      icon={<IconMegaphone size="xs" />}
      onClick={() =>
        openForm?.({
          messagePlaceholder: t('How can we make logs work better for you?'),
          tags: {
            ['feedback.source']: 'logs-listing',
            ['feedback.owner']: 'performance',
          },
        })
      }
    >
      {t('Give Feedback')}
    </Button>
  );
}

export default function LogsContent() {
  const organization = useOrganization();
  const {defaultPeriod, maxPickableDays, relativeOptions} =
    logsPickableDays(organization);

  const onboardingProject = useOnboardingProject({property: 'hasLogs'});

  return (
    <SentryDocumentTitle title={t('Logs')} orgSlug={organization?.slug}>
      <PageFiltersContainer
        maxPickableDays={maxPickableDays}
        defaultSelection={{
          datetime: {
            period: defaultPeriod,
            start: null,
            end: null,
            utc: null,
          },
        }}
      >
        <LogsQueryParamsProvider source="location">
          <LogsPageParamsProvider
            analyticsPageSource={LogsAnalyticsPageSource.EXPLORE_LOGS}
          >
            <Layout.Page>
              <LogsHeader />
              <TraceItemAttributeProvider traceItemType={TraceItemDataset.LOGS} enabled>
                <LogsPageDataProvider>
                  {defined(onboardingProject) ? (
                    <LogsTabOnboarding
                      organization={organization}
                      project={onboardingProject}
                      defaultPeriod={defaultPeriod}
                      maxPickableDays={maxPickableDays}
                      relativeOptions={relativeOptions}
                    />
                  ) : (
                    <LogsTabContent
                      defaultPeriod={defaultPeriod}
                      maxPickableDays={maxPickableDays}
                      relativeOptions={relativeOptions}
                    />
                  )}
                </LogsPageDataProvider>
              </TraceItemAttributeProvider>
            </Layout.Page>
          </LogsPageParamsProvider>
        </LogsQueryParamsProvider>
      </PageFiltersContainer>
    </SentryDocumentTitle>
  );
}

function LogsHeader() {
  const prefersStackedNav = usePrefersStackedNav();

  const pageId = useLogsId();
  const title = useLogsTitle();
  return (
    <Layout.Header unified={prefersStackedNav}>
      <Layout.HeaderContent unified={prefersStackedNav}>
        {title && defined(pageId) ? (
          <ExploreBreadcrumb traceItemDataset={TraceItemDataset.LOGS} />
        ) : null}

        <Layout.Title>
          {title ? title : t('Logs')}
          <FeatureBadge type="new" />
        </Layout.Title>
      </Layout.HeaderContent>
      <Layout.HeaderActions>
        <ButtonBar>
          <FeedbackButton />
        </ButtonBar>
      </Layout.HeaderActions>
    </Layout.Header>
  );
}
