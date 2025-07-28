import {Outlet} from 'react-router-dom';
import styled from '@emotion/styled';

import CodecovQueryParamsProvider from 'sentry/components/codecov/container/codecovParamsProvider';
import * as Layout from 'sentry/components/layouts/thirds';
import QuestionTooltip from 'sentry/components/questionTooltip';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {t} from 'sentry/locale';
import useOrganization from 'sentry/utils/useOrganization';
import {TOKENS_PAGE_TITLE} from 'sentry/views/codecov/settings';

export default function TokensPageWrapper() {
  const organization = useOrganization();

  const tooltip = t('Manage your upload tokens that are created in Sentry Prevent.');

  return (
    <SentryDocumentTitle title={TOKENS_PAGE_TITLE} orgSlug={organization.slug}>
      <Layout.Header unified>
        <Layout.HeaderContent>
          <HeaderContentBar>
            <Layout.Title>
              {TOKENS_PAGE_TITLE}{' '}
              <QuestionTooltip size="md" title={tooltip} isHoverable />
            </Layout.Title>
          </HeaderContentBar>
        </Layout.HeaderContent>
      </Layout.Header>
      <Layout.Body>
        <CodecovQueryParamsProvider>
          <Layout.Main fullWidth>
            <Outlet />
          </Layout.Main>
        </CodecovQueryParamsProvider>
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
