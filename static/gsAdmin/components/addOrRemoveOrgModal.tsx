import {Fragment, useState} from 'react';

import type {ModalRenderProps} from 'sentry/actionCreators/modal';
import {Alert} from 'sentry/components/core/alert';
import TextField from 'sentry/components/forms/fields/inputField';
import SentryOrganizationRoleSelectorField from 'sentry/components/forms/fields/sentryOrganizationRoleSelectorField';
import Form from 'sentry/components/forms/form';
import useApi from 'sentry/utils/useApi';

interface AddOrRemoveOrgModalProps extends ModalRenderProps {
  userId: string;
}

function AddToOrgModal({Header, Body, userId, closeModal}: AddOrRemoveOrgModalProps) {
  const api = useApi();

  const [error, setError] = useState(null);

  const onSubmit = async (data: Record<string, any>) => {
    try {
      await api
        .requestPromise(`/customers/${data.organizationSlug}/users/${userId}/members/`, {
          method: 'POST',
          data: {
            orgRole: data.role,
          },
        })
        .then(() => {
          closeModal();
          window.location.reload();
        });
    } catch (err: any) {
      setError(err.responseJSON.detail);
    }
  };

  return (
    <Fragment>
      <Header closeButton>
        <h4>Add Member to an Organization</h4>
      </Header>
      <Body>
        <Form onSubmit={onSubmit} submitLabel="Submit" cancelLabel="Cancel">
          <TextField
            required
            label="Organization Slug"
            name="organizationSlug"
            help="A unique ID used to identify this organization"
          />
          <SentryOrganizationRoleSelectorField required name="role" label="Role" />
          <Fragment>
            <br />
            Note: This action will be recorded in the audit log.
          </Fragment>
          {error && (
            <Alert.Container>
              <Alert type="danger" showIcon={false}>
                {error}
              </Alert>
            </Alert.Container>
          )}
        </Form>
      </Body>
    </Fragment>
  );
}

function RemoveFromOrgModal({
  Header,
  Body,
  userId,
  closeModal,
}: AddOrRemoveOrgModalProps) {
  const api = useApi();

  const [error, setError] = useState(null);

  const onSubmit = async (data: Record<string, any>) => {
    try {
      await api
        .requestPromise(`/customers/${data.organizationSlug}/users/${userId}/members/`, {
          method: 'DELETE',
        })
        .then(() => {
          closeModal();
          window.location.reload();
        });
    } catch (err: any) {
      setError(err.responseJSON.detail);
    }
  };

  return (
    <Fragment>
      <Header closeButton>
        <h4>Remove Member from an Organization</h4>
      </Header>
      <Body>
        <Form onSubmit={onSubmit} submitLabel="Submit" cancelLabel="Cancel">
          <TextField
            required
            label="Organization Slug"
            name="organizationSlug"
            help="A unique ID used to identify this organization"
          />
          <Fragment>
            <br />
            Note: This action will be recorded in the audit log.
          </Fragment>
          {error && (
            <Alert.Container>
              <Alert type="danger">{error}</Alert>
            </Alert.Container>
          )}
        </Form>
      </Body>
    </Fragment>
  );
}

export {AddToOrgModal, RemoveFromOrgModal};
