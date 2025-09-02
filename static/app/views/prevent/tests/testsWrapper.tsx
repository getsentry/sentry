import {Outlet} from 'react-router-dom';
import styled from '@emotion/styled';

import {FeatureBadge} from 'sentry/components/core/badge/featureBadge';
import * as Layout from 'sentry/components/layouts/thirds';
import PreventQueryParamsProvider from 'sentry/components/prevent/container/preventParamsProvider';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import useOrganization from 'sentry/utils/useOrganization';
import {TESTS_PAGE_TITLE} from 'sentry/views/prevent/settings';

export default function TestAnalyticsPageWrapper() {
  const organization = useOrganization();

  return (
    <SentryDocumentTitle title={TESTS_PAGE_TITLE} orgSlug={organization.slug}>
      <Layout.Header unified>
        <Layout.HeaderContent>
          <HeaderContentBar>
            <Layout.Title>
              {TESTS_PAGE_TITLE}
              <FeatureBadge type="new" />
            </Layout.Title>
          </HeaderContentBar>
        </Layout.HeaderContent>
      </Layout.Header>
      <Layout.Body>
        <PreventQueryParamsProvider>
          <Layout.Main fullWidth>
            <Outlet />
          </Layout.Main>
        </PreventQueryParamsProvider>
      </Layout.Body>
    </SentryDocumentTitle>
  );
}

const HeaderContentBar = styled('div')`
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-direction: row;
`;
