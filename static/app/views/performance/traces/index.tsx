import {Fragment} from 'react';
import styled from '@emotion/styled';

import Feature from 'sentry/components/acl/feature';
import {Alert} from 'sentry/components/alert';
import {Breadcrumbs} from 'sentry/components/breadcrumbs';
import FeedbackWidgetButton from 'sentry/components/feedback/widget/feedbackWidgetButton';
import * as Layout from 'sentry/components/layouts/thirds';
import PageFiltersContainer from 'sentry/components/organizations/pageFilters/container';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {t} from 'sentry/locale';
import useOrganization from 'sentry/utils/useOrganization';
import {normalizeUrl} from 'sentry/utils/withDomainRequired';

import {Content} from './content';

function TraceExplorerLandingPage() {
  const organization = useOrganization();

  return (
    <Fragment>
      <Layout.Header>
        <Layout.HeaderContent>
          <Breadcrumbs
            crumbs={[
              {
                label: 'Performance',
                to: normalizeUrl(`/organizations/${organization.slug}/performance/`),
                preservePageFilters: true,
              },
              {
                label: 'Traces',
              },
            ]}
          />
          <HeaderContentBar>
            <Layout.Title>{t('Traces')}</Layout.Title>
            <FeedbackWidgetButton />
          </HeaderContentBar>
        </Layout.HeaderContent>
      </Layout.Header>
      <Layout.Body>
        <Content />
      </Layout.Body>
    </Fragment>
  );
}

const HeaderContentBar = styled('div')`
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-direction: row;
`;

function NoAccess() {
  return (
    <Layout.Page withPadding>
      <Alert type="warning">{t("You don't have access to this feature")}</Alert>
    </Layout.Page>
  );
}

const DEFAULT_STATS_PERIOD = '24h';

export default function TracesPage() {
  const organization = useOrganization();

  return (
    <SentryDocumentTitle title={t('Traces')} orgSlug={organization.slug}>
      <PageFiltersContainer
        defaultSelection={{
          datetime: {start: null, end: null, utc: null, period: DEFAULT_STATS_PERIOD},
        }}
      >
        <Layout.Page>
          <Feature
            features={['performance-trace-explorer']}
            organization={organization}
            renderDisabled={NoAccess}
          >
            <TraceExplorerLandingPage />
          </Feature>
        </Layout.Page>
      </PageFiltersContainer>
    </SentryDocumentTitle>
  );
}
