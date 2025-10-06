import {FeatureBadge} from 'sentry/components/core/badge/featureBadge';
import {Button} from 'sentry/components/core/button';
import {ButtonBar} from 'sentry/components/core/button/buttonBar';
import * as Layout from 'sentry/components/layouts/thirds';
import PageFiltersContainer from 'sentry/components/organizations/pageFilters/container';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {IconMegaphone} from 'sentry/icons';
import {t} from 'sentry/locale';
import {useFeedbackForm} from 'sentry/utils/useFeedbackForm';
import useOrganization from 'sentry/utils/useOrganization';
import {MetricsTabContent} from 'sentry/views/explore/metrics/metricsTab';

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

  return (
    <SentryDocumentTitle title={t('Metrics')} orgSlug={organization?.slug}>
      <PageFiltersContainer
        // TODO(nar): Setup maxPickableDays and other date selection constraints
        defaultSelection={{
          datetime: {
            period: '24h',
            start: null,
            end: null,
            utc: null,
          },
        }}
      >
        <Layout.Page>
          <MetricsHeader />
          <MetricsTabContent
            defaultPeriod="24h"
            maxPickableDays={7}
            relativeOptions={({arbitraryOptions}) => ({
              ...arbitraryOptions,
              '24h': t('Last 24 hours'),
              '7d': t('Last 7 days'),
              '14d': t('Last 14 days'),
              '30d': t('Last 30 days'),
              '90d': t('Last 90 days'),
            })}
          />
        </Layout.Page>
      </PageFiltersContainer>
    </SentryDocumentTitle>
  );
}

function MetricsHeader() {
  return (
    <Layout.Header unified>
      <Layout.HeaderContent unified>
        <Layout.Title>
          {t('Metrics')}
          <FeatureBadge type="alpha" />
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
