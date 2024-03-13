import styled from '@emotion/styled';

import {Alert} from 'sentry/components/alert';
import LoadingError from 'sentry/components/loadingError';
import LoadingTriangle from 'sentry/components/loadingTriangle';
import {ORGANIZATION_FETCH_ERROR_TYPES} from 'sentry/constants';
import {t} from 'sentry/locale';
import OrganizationStore from 'sentry/stores/organizationStore';
import {useLegacyStore} from 'sentry/stores/useLegacyStore';
import {space} from 'sentry/styles/space';

import {useEnsureOrganization} from './organizationContext';

interface Props {
  children: JSX.Element;
}

/**
 * Ensures the current organization is loaded. A loading indicator will be
 * rendered while loading the organization.
 */
function OrganizationContainer({children}: Props) {
  const {loading, error, errorType} = useLegacyStore(OrganizationStore);
  useEnsureOrganization();

  if (loading) {
    return <LoadingTriangle>{t('Loading data for your organization.')}</LoadingTriangle>;
  }

  // XXX(epurkhiser): There is a special case scenarion when we're unable to
  // load an organization due to access issues. Right now this is VERY SPECIFIC
  // to being able to enable 2FA, or a user not being a member of any org.
  //
  // In this scenario we render the children **explicitly without an
  // organization in context**.
  //
  // TODO(epurkhiser): This scenario desprately should be improved
  if (
    error &&
    errorType &&
    [
      ORGANIZATION_FETCH_ERROR_TYPES.ORG_NO_ACCESS,
      ORGANIZATION_FETCH_ERROR_TYPES.NO_ORGS,
    ].includes(errorType)
  ) {
    return children;
  }

  if (error) {
    const errorBody =
      errorType === ORGANIZATION_FETCH_ERROR_TYPES.ORG_NO_ACCESS ? (
        <Alert type="error" data-test-id="org-access-error">
          {t('You do not have access to this organization.')}
        </Alert>
      ) : errorType === ORGANIZATION_FETCH_ERROR_TYPES.ORG_NOT_FOUND ? (
        <Alert type="error" data-test-id="org-loading-error">
          {t('The organization you were looking for was not found.')}
        </Alert>
      ) : (
        <LoadingError />
      );

    return <ErrorWrapper>{errorBody}</ErrorWrapper>;
  }

  return children;
}

const ErrorWrapper = styled('div')`
  padding: ${space(3)};
`;

export default OrganizationContainer;
