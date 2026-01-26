import {useEffect} from 'react';
import {Outlet} from 'react-router-dom';

import {FeatureBadge} from 'sentry/components/core/badge/featureBadge';
import {Flex} from 'sentry/components/core/layout';
import * as Layout from 'sentry/components/layouts/thirds';
import PreventQueryParamsProvider from 'sentry/components/prevent/container/preventParamsProvider';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import showNewSeer from 'sentry/utils/seer/showNewSeer';
import normalizeUrl from 'sentry/utils/url/normalizeUrl';
import {useNavigate} from 'sentry/utils/useNavigate';
import useOrganization from 'sentry/utils/useOrganization';
import {PREVENT_AI_PAGE_TITLE} from 'sentry/views/prevent/settings';

export default function PreventAIPageWrapper() {
  const organization = useOrganization();
  const navigate = useNavigate();

  useEffect(() => {
    if (showNewSeer(organization)) {
      navigate(normalizeUrl(`/organizations/${organization.slug}/settings/seer/`), {
        replace: true,
      });
    }
  }, [navigate, organization, organization.slug]);

  return (
    <SentryDocumentTitle title={PREVENT_AI_PAGE_TITLE} orgSlug={organization.slug}>
      <Layout.Header unified>
        <Layout.HeaderContent>
          <Flex align="center" justify="between" direction="row">
            <Layout.Title>
              {PREVENT_AI_PAGE_TITLE}
              <FeatureBadge type="beta" />
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
