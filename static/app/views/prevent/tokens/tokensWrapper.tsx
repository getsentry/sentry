import {Outlet} from 'react-router-dom';

import {Flex} from 'sentry/components/core/layout';
import NotFound from 'sentry/components/errors/notFound';
import * as Layout from 'sentry/components/layouts/thirds';
import PreventQueryParamsProvider from 'sentry/components/prevent/container/preventParamsProvider';
import QuestionTooltip from 'sentry/components/questionTooltip';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {t} from 'sentry/locale';
import useOrganization from 'sentry/utils/useOrganization';

export default function TokensPageWrapper() {
  const organization = useOrganization();

  const tooltip = t('Manage your upload tokens that are created in Sentry Prevent.');

  if (!organization.features.includes('prevent-test-analytics')) {
    return <NotFound />;
  }

  return (
    <SentryDocumentTitle title={t('Tokens')} orgSlug={organization.slug}>
      <Layout.Header unified>
        <Layout.HeaderContent>
          <Flex align="center" justify="between" direction="row">
            <Layout.Title>
              {t('Tokens')} <QuestionTooltip size="md" title={tooltip} isHoverable />
            </Layout.Title>
          </Flex>
        </Layout.HeaderContent>
      </Layout.Header>
      <Layout.Body>
        <PreventQueryParamsProvider>
          <Layout.Main width="full">
            <Outlet />
          </Layout.Main>
        </PreventQueryParamsProvider>
      </Layout.Body>
    </SentryDocumentTitle>
  );
}
