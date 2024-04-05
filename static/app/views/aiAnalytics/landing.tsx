import * as Layout from 'sentry/components/layouts/thirds';
import {PageHeadingQuestionTooltip} from 'sentry/components/pageHeadingQuestionTooltip';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {t} from 'sentry/locale';
import useOrganization from 'sentry/utils/useOrganization';

export default function AiAnalyticsPage() {
  const organization = useOrganization();

  return (
    <SentryDocumentTitle title={`AI Analytics — ${organization.slug}`}>
      <Layout.Header>
        <Layout.HeaderContent>
          <Layout.Title>
            {t('AI Analytics')}
            <PageHeadingQuestionTooltip
              title={t('View analytics and information about your AI pipelines')}
              docsUrl="https://docs.sentry.io/product/ai-analytics/"
            />
          </Layout.Title>
        </Layout.HeaderContent>
      </Layout.Header>
    </SentryDocumentTitle>
  );
}
