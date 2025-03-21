import {FeatureBadge} from 'sentry/components/core/badge/featureBadge';
import {Button} from 'sentry/components/core/button';
import {ButtonBar} from 'sentry/components/core/button/buttonBar';
import * as Layout from 'sentry/components/layouts/thirds';
import {usePrefersStackedNav} from 'sentry/components/nav/prefersStackedNav';
import PageFiltersContainer from 'sentry/components/organizations/pageFilters/container';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {IconMegaphone} from 'sentry/icons';
import {t} from 'sentry/locale';
import {useFeedbackForm} from 'sentry/utils/useFeedbackForm';
import useOrganization from 'sentry/utils/useOrganization';
import {LogsPageParamsProvider} from 'sentry/views/explore/contexts/logs/logsPageParams';
import {TraceItemAttributeProvider} from 'sentry/views/explore/contexts/traceItemAttributeContext';
import {LogsTabContent} from 'sentry/views/explore/logs/logsTab';
import {TraceItemDataset} from 'sentry/views/explore/types';
import {limitMaxPickableDays} from 'sentry/views/explore/utils';

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
            ['feedback.source']: 'trace-view',
            ['feedback.owner']: 'performance',
          },
        })
      }
    >
      {t('Give Feedback')}
    </Button>
  );
}

export default function LogsPage() {
  const organization = useOrganization();
  const {defaultPeriod, maxPickableDays, relativeOptions} =
    limitMaxPickableDays(organization);

  const prefersStackedNav = usePrefersStackedNav();

  return (
    <SentryDocumentTitle title={t('Logs')} orgSlug={organization?.slug}>
      <PageFiltersContainer maxPickableDays={maxPickableDays}>
        <Layout.Page>
          <Layout.Header unified={prefersStackedNav}>
            <Layout.HeaderContent unified={prefersStackedNav}>
              <Layout.Title>
                {t('Logs')}
                <FeatureBadge type="experimental" />
              </Layout.Title>
            </Layout.HeaderContent>
            <Layout.HeaderActions>
              <ButtonBar>
                <FeedbackButton />
              </ButtonBar>
            </Layout.HeaderActions>
          </Layout.Header>
          <TraceItemAttributeProvider traceItemType={TraceItemDataset.LOGS} enabled>
            <LogsPageParamsProvider>
              <LogsTabContent
                defaultPeriod={defaultPeriod}
                maxPickableDays={maxPickableDays}
                relativeOptions={relativeOptions}
              />
            </LogsPageParamsProvider>
          </TraceItemAttributeProvider>
        </Layout.Page>
      </PageFiltersContainer>
    </SentryDocumentTitle>
  );
}
