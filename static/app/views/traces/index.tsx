import {Fragment} from 'react';
import styled from '@emotion/styled';

import Feature from 'sentry/components/acl/feature';
import {Alert} from 'sentry/components/alert';
import FeatureBadge from 'sentry/components/badge/featureBadge';
import FeedbackWidgetButton from 'sentry/components/feedback/widget/feedbackWidgetButton';
import * as Layout from 'sentry/components/layouts/thirds';
import PageFiltersContainer from 'sentry/components/organizations/pageFilters/container';
import {PageHeadingQuestionTooltip} from 'sentry/components/pageHeadingQuestionTooltip';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {t} from 'sentry/locale';
import useOrganization from 'sentry/utils/useOrganization';

import {Content} from './content';

export const TRACE_EXPLORER_DOCS_URL = 'https://docs.sentry.io/product/explore/traces/';

function TraceExplorerLandingPage() {
  return (
    <Fragment>
      <Layout.Header>
        <Layout.HeaderContent>
          <HeaderContentBar>
            <Layout.Title>
              {t('Traces')}
              <PageHeadingQuestionTooltip
                docsUrl={TRACE_EXPLORER_DOCS_URL}
                title={t(
                  'Traces lets you search for individual spans that make up a trace, linked by a trace id.'
                )}
              />
              <FeatureBadge type="beta" />
            </Layout.Title>
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
