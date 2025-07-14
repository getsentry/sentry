import {FeatureBadge} from 'sentry/components/core/badge/featureBadge';
import {Button} from 'sentry/components/core/button';
import {ButtonBar} from 'sentry/components/core/button/buttonBar';
import {LinkButton} from 'sentry/components/core/button/linkButton';
import * as Layout from 'sentry/components/layouts/thirds';
import PageFiltersContainer from 'sentry/components/organizations/pageFilters/container';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {IconMegaphone, IconOpen} from 'sentry/icons';
import {t} from 'sentry/locale';
import {trackAnalytics} from 'sentry/utils/analytics';
import {LogsAnalyticsPageSource} from 'sentry/utils/analytics/logsAnalyticsEvent';
import {useFeedbackForm} from 'sentry/utils/useFeedbackForm';
import useOrganization from 'sentry/utils/useOrganization';
import {LogsPageDataProvider} from 'sentry/views/explore/contexts/logs/logsPageData';
import {LogsPageParamsProvider} from 'sentry/views/explore/contexts/logs/logsPageParams';
import {TraceItemAttributeProvider} from 'sentry/views/explore/contexts/traceItemAttributeContext';
import {LOGS_INSTRUCTIONS_URL} from 'sentry/views/explore/logs/constants';
import {LogsTabContent} from 'sentry/views/explore/logs/logsTab';
import {logsPickableDays} from 'sentry/views/explore/logs/utils';
import {TraceItemDataset} from 'sentry/views/explore/types';
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
              <ButtonBar gap="md">
                <FeedbackButton />
                <LinkButton
                  icon={<IconOpen />}
                  priority="primary"
                  href={LOGS_INSTRUCTIONS_URL}
                  external
                  size="xs"
                  onMouseDown={() => {
                    trackAnalytics('logs.doc_link.clicked', {
                      organization,
                    });
                  }}
                >
                  {t('Set Up Logs')}
                </LinkButton>
              </ButtonBar>
            </Layout.HeaderActions>
          </Layout.Header>
          <TraceItemAttributeProvider traceItemType={TraceItemDataset.LOGS} enabled>
            <LogsPageParamsProvider
              analyticsPageSource={LogsAnalyticsPageSource.EXPLORE_LOGS}
            >
              <LogsPageDataProvider>
                <LogsTabContent
                  defaultPeriod={defaultPeriod}
                  maxPickableDays={maxPickableDays}
                  relativeOptions={relativeOptions}
                />
              </LogsPageDataProvider>
            </LogsPageParamsProvider>
          </TraceItemAttributeProvider>
        </Layout.Page>
      </PageFiltersContainer>
    </SentryDocumentTitle>
  );
}
