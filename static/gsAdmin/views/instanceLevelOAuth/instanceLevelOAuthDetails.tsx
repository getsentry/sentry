import {Fragment, useCallback, useEffect, useState} from 'react';
import styled from '@emotion/styled';

import {addErrorMessage} from 'sentry/actionCreators/indicator';
import {openModal} from 'sentry/actionCreators/modal';
import {Button} from 'sentry/components/core/button';
import {Flex} from 'sentry/components/core/layout';
import ApiForm from 'sentry/components/forms/apiForm';
import TextField from 'sentry/components/forms/fields/textField';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {getFormattedDate} from 'sentry/utils/dates';
import {handleXhrErrorResponse} from 'sentry/utils/handleXhrErrorResponse';
import useApi from 'sentry/utils/useApi';
import useRouter from 'sentry/utils/useRouter';

import PageHeader from 'admin/components/pageHeader';

import ConfirmClientDeleteModal from './components/confirmClientDeleteModal';

type ClientDetails = {
  allowedOrigins: string | null;
  clientID: string | null;
  createdAt: string | null;
  homepageUrl: string | null;
  id: string | null;
  name: string | null;
  privacyUrl: string | null;
  redirectUris: string | null;
  termsUrl: string | null;
};

const fieldProps = {
  stacked: true,
  inline: false,
  flexibleControlStateSize: true,
} as const;

function InstanceLevelOAuthDetails() {
  const api = useApi();
  const router = useRouter();

  const [clientDetails, setClientDetails] = useState<ClientDetails | null>();
  const [errorMessage, setErrorMessage] = useState<string | null>();
  const [loading, setLoading] = useState<boolean>(true);

  const fetchClientData = useCallback(async () => {
    try {
      const response = await api.requestPromise(
        `/_admin/instance-level-oauth/${router.params.clientID}/`,
        {}
      );

      setClientDetails({
        name: response.name,
        id: response.id,
        clientID: response.clientID,
        createdAt: getFormattedDate(response.dateAdded, 'MMM Do YYYY'),
        allowedOrigins: response.allowedOrigins.join(' '),
        homepageUrl: response.homepageUrl,
        redirectUris: response.redirectUris.join(' '),
        privacyUrl: response.privacyUrl,
        termsUrl: response.termsUrl,
      });
    } catch (err) {
      const message = 'Unable to load client data';
      handleXhrErrorResponse(message, err);
      addErrorMessage(message);
      setErrorMessage(message);
    } finally {
      setLoading(false);
    }
  }, [router.params.clientID, api]);

  useEffect(() => {
    fetchClientData();
  }, [fetchClientData]);

  return (
    <div>
      {loading && <LoadingIndicator />}
      {clientDetails && (
        <Fragment>
          <PageHeader
            title={`Details For Instance Level OAuth Client: ${clientDetails.name}`}
          />
          <ApiForm
            apiMethod="PUT"
            apiEndpoint={`/_admin/instance-level-oauth/${clientDetails.clientID}/`}
            onSubmitSuccess={() => window.location.reload()}
            submitLabel="Save Client Settings"
          >
            <TextField
              {...fieldProps}
              name="clientID"
              label="Client ID"
              defaultValue={clientDetails.clientID}
              help="ID of the selected client (not modifiable)"
              disabled
            />
            <TextField
              {...fieldProps}
              name="name"
              label="Client Name"
              defaultValue={clientDetails.name}
              help="Human readable name for the client"
              placeholder="e.g. CodeCov"
              required
            />
            <TextField
              {...fieldProps}
              name="redirectUris"
              label="Redirect URIs (space separated)"
              defaultValue={clientDetails.redirectUris}
              help="The URL that users will redirect to after login/signup"
              placeholder="e.g. https://notsentry.io/redirect"
              required
            />
            <TextField
              {...fieldProps}
              name="allowedOrigins"
              label="Allowed Origins (space separated)"
              placeholder="e.g. https://notsentry.io/origin"
              defaultValue={clientDetails.allowedOrigins}
              help="Allowed origins for the client"
            />
            <TextField
              {...fieldProps}
              name="homepageUrl"
              label="Homepage URL"
              placeholder="e.g. https://notsentry.io/home"
              defaultValue={clientDetails.homepageUrl}
              help="Client's homepage"
            />
            <TextField
              {...fieldProps}
              name="privacyUrl"
              label="Privacy Policy URL"
              placeholder="e.g. https://notsentry.io/privacy"
              defaultValue={clientDetails.privacyUrl}
              help="URL to client's privacy policy"
            />
            <TextField
              {...fieldProps}
              name="termsUrl"
              label="Terms and Conditions URL"
              placeholder="e.g. https://notsentry.io/terms"
              defaultValue={clientDetails.termsUrl}
              help="URL to client's terms and conditions"
            />
            <p>
              <b>Date added:</b> {clientDetails.createdAt}
            </p>
          </ApiForm>
          <Flex justify="right">
            <StyledButton
              size="sm"
              priority="danger"
              onClick={() =>
                openModal(deps => (
                  <ConfirmClientDeleteModal
                    {...deps}
                    clientID={clientDetails.clientID}
                    name={clientDetails.name}
                  />
                ))
              }
            >
              Delete client
            </StyledButton>
          </Flex>
        </Fragment>
      )}
      {errorMessage && <p>{errorMessage}</p>}
    </div>
  );
}

export default InstanceLevelOAuthDetails;

const StyledButton = styled(Button)`
  margin-top: 20px;
  margin-bottom: 15px;
`;
