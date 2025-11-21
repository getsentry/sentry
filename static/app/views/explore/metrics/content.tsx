import {FeatureBadge} from 'sentry/components/core/badge/featureBadge';
import {Button} from 'sentry/components/core/button';
import {ButtonBar} from 'sentry/components/core/button/buttonBar';
import * as Layout from 'sentry/components/layouts/thirds';
import PageFiltersContainer from 'sentry/components/organizations/pageFilters/container';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {IconMegaphone} from 'sentry/icons';
import {t} from 'sentry/locale';
import {defined} from 'sentry/utils';
import {useFeedbackForm} from 'sentry/utils/useFeedbackForm';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import ExploreBreadcrumb from 'sentry/views/explore/components/breadcrumb';
import {useGetSavedQuery} from 'sentry/views/explore/hooks/useGetSavedQueries';
import {MetricsTabOnboarding} from 'sentry/views/explore/metrics/metricsOnboarding';
import {MetricsTabContent} from 'sentry/views/explore/metrics/metricsTab';
import {metricsPickableDays} from 'sentry/views/explore/metrics/utils';
import {
  getIdFromLocation,
  getTitleFromLocation,
  ID_KEY,
  TITLE_KEY,
} from 'sentry/views/explore/queryParams/savedQuery';
import {TraceItemDataset} from 'sentry/views/explore/types';
import {useOnboardingProject} from 'sentry/views/insights/common/queries/useOnboardingProject';

function FeedbackButton() {
  const openForm = useFeedbackForm();

  if (!openForm) {
    return null;
  }
  return (
    <Button
      size="xs"
      aria-label="trace-metrics-feedback"
      icon={<IconMegaphone size="xs" />}
      onClick={() =>
        openForm?.({
          messagePlaceholder: t('How can we make metrics work better for you?'),
          tags: {
            ['feedback.source']: 'metrics-listing',
            ['feedback.owner']: 'performance',
          },
        })
      }
    >
      {t('Give Feedback')}
    </Button>
  );
}

export default function MetricsContent() {
  const organization = useOrganization();
  const onboardingProject = useOnboardingProject({property: 'hasTraceMetrics'});
  const {defaultPeriod, maxPickableDays, relativeOptions} = metricsPickableDays();
  return (
    <SentryDocumentTitle title={t('Metrics')} orgSlug={organization?.slug}>
      <PageFiltersContainer
        defaultSelection={{
          datetime: {
            period: defaultPeriod,
            start: null,
            end: null,
            utc: null,
          },
        }}
      >
        <Layout.Page>
          <MetricsHeader />
          {defined(onboardingProject) ? (
            <MetricsTabOnboarding
              organization={organization}
              project={onboardingProject}
              defaultPeriod={defaultPeriod}
              maxPickableDays={maxPickableDays}
              relativeOptions={relativeOptions}
            />
          ) : (
            <MetricsTabContent
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

function MetricsHeader() {
  const location = useLocation();
  const pageId = getIdFromLocation(location, ID_KEY);
  const title = getTitleFromLocation(location, TITLE_KEY);
  const organization = useOrganization();
  const {data: savedQuery} = useGetSavedQuery(pageId);

  const hasSavedQueryTitle =
    defined(pageId) && defined(savedQuery) && savedQuery.name.length > 0;

  return (
    <Layout.Header unified>
      <Layout.HeaderContent unified>
        {hasSavedQueryTitle ? (
          <SentryDocumentTitle
            title={`${savedQuery.name} — ${t('Metrics')}`}
            orgSlug={organization?.slug}
          />
        ) : null}
        {title && defined(pageId) ? (
          <ExploreBreadcrumb traceItemDataset={TraceItemDataset.TRACEMETRICS} />
        ) : null}
        <Layout.Title>
          {title ? title : t('Metrics')}
          <FeatureBadge type="beta" />
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
