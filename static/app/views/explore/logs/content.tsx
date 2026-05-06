import {Fragment} from 'react';
import styled from '@emotion/styled';

import {Stack} from '@sentry/scraps/layout';

import {AnalyticsArea} from 'sentry/components/analyticsArea';
import {FeedbackButton} from 'sentry/components/feedbackButton/feedbackButton';
import {PageFiltersContainer} from 'sentry/components/pageFilters/container';
import {PageHeadingQuestionTooltip} from 'sentry/components/pageHeadingQuestionTooltip';
import {SentryDocumentTitle} from 'sentry/components/sentryDocumentTitle';
import {t} from 'sentry/locale';
import {DataCategory} from 'sentry/types/core';
import {defined} from 'sentry/utils';
import {LogsAnalyticsPageSource} from 'sentry/utils/analytics/logsAnalyticsEvent';
import {useDatePageFilterProps} from 'sentry/utils/useDatePageFilterProps';
import {SHORT_VIEWPORT_HEIGHT} from 'sentry/utils/useIsShortViewport';
import {useMaxPickableDays} from 'sentry/utils/useMaxPickableDays';
import {useOrganization} from 'sentry/utils/useOrganization';
import {ExploreBreadcrumb} from 'sentry/views/explore/components/breadcrumb';
import {LogsPageDataProvider} from 'sentry/views/explore/contexts/logs/logsPageData';
import {useGetSavedQuery} from 'sentry/views/explore/hooks/useGetSavedQueries';
import {LogsTabOnboarding} from 'sentry/views/explore/logs/logsOnboarding';
import {LogsQueryParamsProvider} from 'sentry/views/explore/logs/logsQueryParamsProvider';
import {LogsTabContent} from 'sentry/views/explore/logs/logsTab';
import {useOurLogsTableExpando} from 'sentry/views/explore/logs/tables/useOurLogsTableExpando';
import {
  useQueryParamsId,
  useQueryParamsTitle,
} from 'sentry/views/explore/queryParams/context';
import {TraceItemDataset} from 'sentry/views/explore/types';
import {useOnboardingProject} from 'sentry/views/insights/common/queries/useOnboardingProject';
import {TopBar} from 'sentry/views/navigation/topBar';

export default function LogsContent() {
  const organization = useOrganization();
  const maxPickableDays = useMaxPickableDays({
    dataCategories: [DataCategory.LOG_BYTE],
  });
  const datePageFilterProps = useDatePageFilterProps(maxPickableDays);
  const tableExpando = useOurLogsTableExpando();

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
          <LogsPageStack
            flex={1}
            data-footer-constrained={tableExpando ? '' : undefined}
            data-hide-footer={tableExpando ? '' : undefined}
          >
            <LogsQueryParamsProvider
              analyticsPageSource={LogsAnalyticsPageSource.EXPLORE_LOGS}
              source="location"
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
            </LogsQueryParamsProvider>
          </LogsPageStack>
        </AnalyticsArea>
      </PageFiltersContainer>
    </SentryDocumentTitle>
  );
}

const LogsPageStack = styled(Stack)`
  @media (max-height: ${SHORT_VIEWPORT_HEIGHT}px) {
    &[data-footer-constrained] ~ footer {
      display: none;
    }
  }

  &[data-hide-footer] ~ footer {
    display: none;
  }
`;

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
