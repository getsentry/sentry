import {ButtonBar} from 'sentry/components/core/button/buttonBar';
import {LinkButton} from 'sentry/components/core/button/linkButton';
import FeedbackButton from 'sentry/components/feedbackButton/feedbackButton';
import * as Layout from 'sentry/components/layouts/thirds';
import PageFiltersContainer from 'sentry/components/organizations/pageFilters/container';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {withoutLoggingSupport} from 'sentry/data/platformCategories';
import {platforms} from 'sentry/data/platforms';
import {IconOpen} from 'sentry/icons';
import {t} from 'sentry/locale';
import {DataCategory} from 'sentry/types/core';
import {defined} from 'sentry/utils';
import {trackAnalytics} from 'sentry/utils/analytics';
import {LogsAnalyticsPageSource} from 'sentry/utils/analytics/logsAnalyticsEvent';
import {useDatePageFilterProps} from 'sentry/utils/useDatePageFilterProps';
import {useMaxPickableDays} from 'sentry/utils/useMaxPickableDays';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';
import useProjects from 'sentry/utils/useProjects';
import ExploreBreadcrumb from 'sentry/views/explore/components/breadcrumb';
import {LogsPageDataProvider} from 'sentry/views/explore/contexts/logs/logsPageData';
import {TraceItemAttributeProvider} from 'sentry/views/explore/contexts/traceItemAttributeContext';
import {useGetSavedQuery} from 'sentry/views/explore/hooks/useGetSavedQueries';
import {LogsTabOnboarding} from 'sentry/views/explore/logs/logsOnboarding';
import {LogsQueryParamsProvider} from 'sentry/views/explore/logs/logsQueryParamsProvider';
import {LogsTabContent} from 'sentry/views/explore/logs/logsTab';
import {
  useQueryParamsId,
  useQueryParamsTitle,
} from 'sentry/views/explore/queryParams/context';
import {TraceItemDataset} from 'sentry/views/explore/types';
import {useOnboardingProject} from 'sentry/views/insights/common/queries/useOnboardingProject';

export default function LogsContent() {
  const organization = useOrganization();
  const maxPickableDays = useMaxPickableDays({
    dataCategories: [DataCategory.LOG_BYTE],
  });
  const datePageFilterProps = useDatePageFilterProps(maxPickableDays);

  const onboardingProject = useOnboardingProject({property: 'hasLogs'});

  return (
    <SentryDocumentTitle title={t('Logs')} orgSlug={organization?.slug}>
      <PageFiltersContainer
        maxPickableDays={datePageFilterProps.maxPickableDays}
        defaultSelection={
          datePageFilterProps.defaultPeriod
            ? {
                datetime: {
                  period: datePageFilterProps.defaultPeriod,
                  start: null,
                  end: null,
                  utc: null,
                },
              }
            : undefined
        }
      >
        <LogsQueryParamsProvider
          analyticsPageSource={LogsAnalyticsPageSource.EXPLORE_LOGS}
          source="location"
        >
          <Layout.Page>
            <LogsHeader />
            <TraceItemAttributeProvider traceItemType={TraceItemDataset.LOGS} enabled>
              <LogsPageDataProvider allowHighFidelity>
                {defined(onboardingProject) ? (
                  <LogsTabOnboarding
                    organization={organization}
                    project={onboardingProject}
                    datePageFilterProps={datePageFilterProps}
                  />
                ) : (
                  <LogsTabContent datePageFilterProps={datePageFilterProps} />
                )}
              </LogsPageDataProvider>
            </TraceItemAttributeProvider>
          </Layout.Page>
        </LogsQueryParamsProvider>
      </PageFiltersContainer>
    </SentryDocumentTitle>
  );
}

function LogsHeader() {
  const pageId = useQueryParamsId();
  const title = useQueryParamsTitle();
  const organization = useOrganization();
  const {data: savedQuery} = useGetSavedQuery(pageId);

  const hasSavedQueryTitle =
    defined(pageId) && defined(savedQuery) && savedQuery.name.length > 0;

  return (
    <Layout.Header unified>
      <Layout.HeaderContent unified>
        {hasSavedQueryTitle ? (
          <SentryDocumentTitle
            title={`${savedQuery.name} — ${t('Logs')}`}
            orgSlug={organization?.slug}
          />
        ) : null}
        {title && defined(pageId) ? (
          <ExploreBreadcrumb traceItemDataset={TraceItemDataset.LOGS} />
        ) : null}

        <Layout.Title>{title ? title : t('Logs')}</Layout.Title>
      </Layout.HeaderContent>
      <Layout.HeaderActions>
        <ButtonBar>
          <FeedbackButton
            size="xs"
            feedbackOptions={{
              messagePlaceholder: t('How can we make logs work better for you?'),
              tags: {
                ['feedback.source']: 'logs-listing',
                ['feedback.owner']: 'performance',
              },
            }}
          />
          <SetupLogsButton />
        </ButtonBar>
      </Layout.HeaderActions>
    </Layout.Header>
  );
}

function SetupLogsButton() {
  const organization = useOrganization();
  const projects = useProjects();
  const pageFilters = usePageFilters();
  let project = projects.projects?.[0];

  const filtered = projects.projects?.filter(p =>
    pageFilters.selection.projects.includes(parseInt(p.id, 10))
  );
  if (filtered && filtered.length > 0) {
    project = filtered[0];
  }

  const currentPlatform = project?.platform
    ? platforms.find(p => p.id === project.platform)
    : undefined;

  const doesNotSupportLogging = currentPlatform
    ? withoutLoggingSupport.has(currentPlatform.id)
    : false;

  return (
    <LinkButton
      icon={<IconOpen />}
      priority="primary"
      href="https://docs.sentry.io/product/explore/logs/getting-started/"
      external
      size="xs"
      onClick={() => {
        trackAnalytics('logs.explorer.setup_button_clicked', {
          organization,
          platform: currentPlatform?.id ?? 'unknown',
          supports_onboarding_checklist: !doesNotSupportLogging,
        });
      }}
    >
      {t('Set Up Logs')}
    </LinkButton>
  );
}
