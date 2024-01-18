import {Fragment} from 'react';
import styled from '@emotion/styled';

import {Alert} from 'sentry/components/alert';
import HookOrDefault from 'sentry/components/hookOrDefault';
import LoadingError from 'sentry/components/loadingError';
import LoadingTriangle from 'sentry/components/loadingTriangle';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import Sidebar from 'sentry/components/sidebar';
import {ORGANIZATION_FETCH_ERROR_TYPES} from 'sentry/constants';
import {t} from 'sentry/locale';
import OrganizationStore from 'sentry/stores/organizationStore';
import {useLegacyStore} from 'sentry/stores/useLegacyStore';
import {space} from 'sentry/styles/space';

import {useEnsureOrganization} from './organizationContext';

interface OrganizationLayoutProps {
  children: React.ReactNode;
  /**
   * Render the sidebar when possible if enabled
   */
  includeSidebar: boolean;
}

const OrganizationHeader = HookOrDefault({
  hookName: 'component:organization-header',
});

/**
 * Renders the organization page layout
 */
function OrganizationLayout({includeSidebar, children}: OrganizationLayoutProps) {
  const {organization, loading, error, errorType} = useLegacyStore(OrganizationStore);
  useEnsureOrganization();

  if (loading) {
    return <LoadingTriangle>{t('Loading data for your organization.')}</LoadingTriangle>;
  }

  const mainBody = (
    <SentryDocumentTitle noSuffix title={organization?.name ?? 'Sentry'}>
      <div className="app">
        {organization && <OrganizationHeader organization={organization} />}
        {includeSidebar && <Sidebar organization={organization ?? undefined} />}
        {children}
      </div>
    </SentryDocumentTitle>
  );

  if (error) {
    const errorBody =
      errorType === ORGANIZATION_FETCH_ERROR_TYPES.ORG_NO_ACCESS ? (
        // We can still render when an org can't be loaded due to 401. The
        // backend will handle redirects when this is a problem.
        mainBody
      ) : errorType === ORGANIZATION_FETCH_ERROR_TYPES.ORG_NOT_FOUND ? (
        <Alert type="error" data-test-id="org-loading-error">
          {t('The organization you were looking for was not found.')}
        </Alert>
      ) : (
        <LoadingError />
      );

    return (
      <Fragment>
        {includeSidebar && <Sidebar organization={organization ?? undefined} />}
        <ErrorWrapper>{errorBody}</ErrorWrapper>
      </Fragment>
    );
  }

  return mainBody;
}

const ErrorWrapper = styled('div')`
  padding: ${space(3)};
`;

export default OrganizationLayout;
