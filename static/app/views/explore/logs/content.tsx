import {FeatureBadge} from 'sentry/components/core/badge/featureBadge';
import {Button} from 'sentry/components/core/button';
import {ButtonBar} from 'sentry/components/core/button/buttonBar';
import * as Layout from 'sentry/components/layouts/thirds';
import PageFiltersContainer from 'sentry/components/organizations/pageFilters/container';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {IconMegaphone} from 'sentry/icons';
import {t} from 'sentry/locale';
import type {Organization} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';
import {defined} from 'sentry/utils';
import {LogsAnalyticsPageSource} from 'sentry/utils/analytics/logsAnalyticsEvent';
import {useFeedbackForm} from 'sentry/utils/useFeedbackForm';
import useOrganization from 'sentry/utils/useOrganization';
import {LogsPageDataProvider} from 'sentry/views/explore/contexts/logs/logsPageData';
import {LogsPageParamsProvider} from 'sentry/views/explore/contexts/logs/logsPageParams';
import {TraceItemAttributeProvider} from 'sentry/views/explore/contexts/traceItemAttributeContext';
import {LogsTabOnboarding} from 'sentry/views/explore/logs/logsOnboarding';
import {LogsQueryParamsProvider} from 'sentry/views/explore/logs/logsQueryParamsProvider';
import {LogsTabContent} from 'sentry/views/explore/logs/logsTab';
import {logsPickableDays} from 'sentry/views/explore/logs/utils';
import {TraceItemDataset} from 'sentry/views/explore/types';
import type {PickableDays} from 'sentry/views/explore/utils';
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

  const prefersStackedNav = usePrefersStackedNav();
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
        <Layout.Page>
          <Layout.Header unified={prefersStackedNav}>
            <Layout.HeaderContent unified={prefersStackedNav}>
              <Layout.Title>
                {t('Logs')}
                <FeatureBadge
                  type="beta"
                  tooltipProps={{
                    title: t(
                      "This feature is currently in beta and we're actively working on it"
                    ),
                    isHoverable: true,
                  }}
                />
              </Layout.Title>
            </Layout.HeaderContent>
            <Layout.HeaderActions>
              <ButtonBar>
                <FeedbackButton />
              </ButtonBar>
            </Layout.HeaderActions>
          </Layout.Header>
          <LogsTabContentWrapper
            defaultPeriod={defaultPeriod}
            maxPickableDays={maxPickableDays}
            relativeOptions={relativeOptions}
            onboardingProject={onboardingProject}
            organization={organization}
          />
        </Layout.Page>
      </PageFiltersContainer>
    </SentryDocumentTitle>
  );
}

function LogsTabContentWrapper({
  onboardingProject,
  defaultPeriod,
  maxPickableDays,
  relativeOptions,
  organization,
}: PickableDays & {
  onboardingProject: Project | undefined;
  organization: Organization;
}) {
  return (
    <TraceItemAttributeProvider traceItemType={TraceItemDataset.LOGS} enabled>
      <LogsQueryParamsProvider source="location">
        <LogsPageParamsProvider
          analyticsPageSource={LogsAnalyticsPageSource.EXPLORE_LOGS}
        >
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
        </LogsPageParamsProvider>
      </LogsQueryParamsProvider>
    </TraceItemAttributeProvider>
  );
}
