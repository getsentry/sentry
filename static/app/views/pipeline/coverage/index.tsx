import styled from '@emotion/styled';

import {FeatureBadge} from 'sentry/components/core/badge/featureBadge';
import * as Layout from 'sentry/components/layouts/thirds';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import useOrganization from 'sentry/utils/useOrganization';
import {COVERAGE_PAGE_TITLE} from 'sentry/views/pipeline/settings';

interface Props {
  children: React.ReactNode;
}

export default function CoveragePageWrapper({children}: Props) {
  const organization = useOrganization();

  return (
    <SentryDocumentTitle title={COVERAGE_PAGE_TITLE} orgSlug={organization.slug}>
      <Layout.Header unified>
        <Layout.HeaderContent>
          <HeaderContentBar>
            <Layout.Title>
              {COVERAGE_PAGE_TITLE}
              <FeatureBadge type="new" variant="badge" />
            </Layout.Title>
          </HeaderContentBar>
        </Layout.HeaderContent>
      </Layout.Header>
      <Layout.Body>
        <Layout.Main fullWidth>{children}</Layout.Main>
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
