import {Fragment} from 'react';

import {LinkButton} from '@sentry/scraps/button';
import {Grid} from '@sentry/scraps/layout';

import {AnalyticsArea} from 'sentry/components/analyticsArea';
import {FeedbackButton} from 'sentry/components/feedbackButton/feedbackButton';
import * as Layout from 'sentry/components/layouts/thirds';
import {PageFiltersContainer} from 'sentry/components/pageFilters/container';
import {usePageFilters} from 'sentry/components/pageFilters/usePageFilters';
import {PageHeadingQuestionTooltip} from 'sentry/components/pageHeadingQuestionTooltip';
import {SentryDocumentTitle} from 'sentry/components/sentryDocumentTitle';
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
import {useOrganization} from 'sentry/utils/useOrganization';
import {useProjects} from 'sentry/utils/useProjects';
import {ExploreBreadcrumb} from 'sentry/views/explore/components/breadcrumb';
import {ViewportConstrainedPage} from 'sentry/views/explore/components/viewportConstrainedPage';
import {LogsPageDataProvider} from 'sentry/views/explore/contexts/logs/logsPageData';
import {useGetSavedQuery} from 'sentry/views/explore/hooks/useGetSavedQueries';
import {LogsTabOnboarding} from 'sentry/views/explore/logs/logsOnboarding';
import {LogsQueryParamsProvider} from 'sentry/views/explore/logs/logsQueryParamsProvider';
import {LogsTabContent} from 'sentry/views/explore/logs/logsTab';
import {useTableExpando} from 'sentry/views/explore/logs/tables/useTableExpando';
import {
  useQueryParamsId,
  useQueryParamsTitle,
} from 'sentry/views/explore/queryParams/context';
import {TraceItemDataset} from 'sentry/views/explore/types';
import {useOnboardingProject} from 'sentry/views/insights/common/queries/useOnboardingProject';
import {TopBar} from 'sentry/views/navigation/topBar';
import {useHasPageFrameFeature} from 'sentry/views/navigation/useHasPageFrameFeature';

export default function LogsContent() {
  const organization = useOrganization();
  const tableExpando = useTableExpando();
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
        <AnalyticsArea name="explore.logs">
          <LogsQueryParamsProvider
            analyticsPageSource={LogsAnalyticsPageSource.EXPLORE_LOGS}
            source="location"
          >
            <ViewportConstrainedPage
              constrained={tableExpando.enabled}
              hideFooter={tableExpando.expanded === true}
            >
              <LogsHeader />
              <LogsPageDataProvider allowHighFidelity>
                {defined(onboardingProject) ? (
                  <LogsTabOnboarding
                    organization={organization}
                    project={onboardingProject}
                    datePageFilterProps={datePageFilterProps}
                  />
                ) : (
                  <LogsTabContent
                    datePageFilterProps={datePageFilterProps}
                    tableExpando={tableExpando}
                  />
                )}
              </LogsPageDataProvider>
            </ViewportConstrainedPage>
          </LogsQueryParamsProvider>
        </AnalyticsArea>
      </PageFiltersContainer>
    </SentryDocumentTitle>
  );
}

const logsFeedbackOptions = {
  messagePlaceholder: t('How can we make logs work better for you?'),
  tags: {
    ['feedback.source']: 'logs-listing',
    ['feedback.owner']: 'performance',
  },
};

function LogsHeader() {
  const pageId = useQueryParamsId();
  const title = useQueryParamsTitle();
  const organization = useOrganization();
  const {data: savedQuery} = useGetSavedQuery(pageId);
  const onboardingProject = useOnboardingProject({property: 'hasLogs'});
  const hasPageFrameFeature = useHasPageFrameFeature();

  const hasSavedQueryTitle =
    defined(pageId) && defined(savedQuery) && savedQuery.name.length > 0;

  const documentTitle = hasSavedQueryTitle ? (
    <SentryDocumentTitle
      title={`${savedQuery.name} — ${t('Logs')}`}
      orgSlug={organization?.slug}
    />
  ) : null;

  const titleTooltip = (
    <PageHeadingQuestionTooltip
      docsUrl="https://docs.sentry.io/product/explore/logs/"
      title={t(
        'Detailed structured logs, linked to errors and traces, for debugging and investigation.'
      )}
      linkLabel={t('Read the Docs')}
    />
  );

  const hasBreadcrumb = Boolean(title && defined(pageId));

  if (hasPageFrameFeature) {
    return (
      <Fragment>
        {documentTitle}
        <TopBar.Slot name="title">
          {hasBreadcrumb ? (
            <ExploreBreadcrumb
              traceItemDataset={TraceItemDataset.LOGS}
              savedQueryName={savedQuery?.name}
            />
          ) : (
            title || t('Logs')
          )}
          {titleTooltip}
        </TopBar.Slot>
        {defined(onboardingProject) && (
          <TopBar.Slot name="actions">
            <SetupLogsButton />
          </TopBar.Slot>
        )}
        <TopBar.Slot name="feedback">
          <FeedbackButton
            feedbackOptions={logsFeedbackOptions}
            aria-label={t('Give Feedback')}
            tooltipProps={{title: t('Give Feedback')}}
          >
            {null}
          </FeedbackButton>
        </TopBar.Slot>
      </Fragment>
    );
  }

  return (
    <Layout.Header unified>
      <Layout.HeaderContent unified>
        {documentTitle}
        {hasBreadcrumb ? (
          <ExploreBreadcrumb
            traceItemDataset={TraceItemDataset.LOGS}
            savedQueryName={savedQuery?.name}
          />
        ) : null}
        <Layout.Title>
          {title || t('Logs')}
          {titleTooltip}
        </Layout.Title>
      </Layout.HeaderContent>
      <Layout.HeaderActions>
        <Grid flow="column" align="center" gap="md">
          <FeedbackButton feedbackOptions={logsFeedbackOptions} />
          {defined(onboardingProject) && <SetupLogsButton />}
        </Grid>
      </Layout.HeaderActions>
    </Layout.Header>
  );
}

function SetupLogsButton() {
  const organization = useOrganization();
  const projects = useProjects();
  const pageFilters = usePageFilters();
  const hasPageFrameFeature = useHasPageFrameFeature();
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
      size={hasPageFrameFeature ? undefined : 'xs'}
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
