import {useMutation} from '@tanstack/react-query';
import {z} from 'zod';

import {Alert} from '@sentry/scraps/alert';
import {defaultFormOptions, useScrapsForm} from '@sentry/scraps/form';
import {Stack} from '@sentry/scraps/layout';
import {Heading, Text} from '@sentry/scraps/text';

import type {ModalRenderProps} from 'sentry/actionCreators/modal';
import {ORG_ROLES} from 'sentry/constants';
import {fetchMutation} from 'sentry/utils/queryClient';
import {RequestError} from 'sentry/utils/requestError/requestError';

interface AddOrRemoveOrgModalProps extends ModalRenderProps {
  userId: string;
}

type AddToOrgFormValues = {
  organizationSlug: string;
  role: string;
};

type RemoveFromOrgFormValues = {
  organizationSlug: string;
};

const addToOrgSchema = z.object({
  organizationSlug: z.string().min(1, 'Organization slug is required'),
  role: z.string().min(1, 'Role is required'),
});

const removeFromOrgSchema = z.object({
  organizationSlug: z.string().min(1, 'Organization slug is required'),
});

function getMutationErrorMessage(error: Error | null, fallback: string) {
  const detail = error instanceof RequestError ? error.responseJSON?.detail : undefined;
  return error ? (typeof detail === 'string' ? detail : fallback) : null;
}

function AddToOrgModal({
  Header,
  Body,
  Footer,
  userId,
  closeModal,
}: AddOrRemoveOrgModalProps) {
  const mutation = useMutation({
    mutationFn: (data: AddToOrgFormValues) =>
      fetchMutation({
        url: `/customers/${data.organizationSlug}/users/${userId}/members/`,
        method: 'POST',
        data: {orgRole: data.role},
      }),
    onSuccess: () => {
      closeModal();
      window.location.reload();
    },
  });

  const errorMessage = getMutationErrorMessage(mutation.error, 'Unable to add member');

  const form = useScrapsForm({
    ...defaultFormOptions,
    defaultValues: {organizationSlug: '', role: ''},
    validators: {onDynamic: addToOrgSchema},
    onSubmit: ({value}) => mutation.mutateAsync(value).catch(() => {}),
  });

  return (
    <form.AppForm form={form}>
      <Header closeButton>
        <Heading as="h4">Add Member to an Organization</Heading>
      </Header>
      <Body>
        <Stack gap="lg">
          <form.AppField name="organizationSlug">
            {field => (
              <field.Layout.Stack
                label="Organization Slug"
                hintText="A unique ID used to identify this organization"
                required
              >
                <field.Input value={field.state.value} onChange={field.handleChange} />
              </field.Layout.Stack>
            )}
          </form.AppField>
          <form.AppField name="role">
            {field => (
              <field.Layout.Stack label="Role" required>
                <field.Select
                  value={field.state.value}
                  onChange={field.handleChange}
                  options={ORG_ROLES.map(role => ({
                    value: role.id,
                    label: role.name,
                  }))}
                  placeholder="Choose a role"
                />
              </field.Layout.Stack>
            )}
          </form.AppField>
          <Text>Note: This action will be recorded in the audit log.</Text>
          {errorMessage && (
            <Alert.Container>
              <Alert variant="danger" showIcon={false}>
                {errorMessage}
              </Alert>
            </Alert.Container>
          )}
        </Stack>
      </Body>
      <Footer>
        <form.SubmitButton>Submit</form.SubmitButton>
      </Footer>
    </form.AppForm>
  );
}

function RemoveFromOrgModal({
  Header,
  Body,
  Footer,
  userId,
  closeModal,
}: AddOrRemoveOrgModalProps) {
  const mutation = useMutation({
    mutationFn: (data: RemoveFromOrgFormValues) =>
      fetchMutation({
        url: `/customers/${data.organizationSlug}/users/${userId}/members/`,
        method: 'DELETE',
      }),
    onSuccess: () => {
      closeModal();
      window.location.reload();
    },
  });

  const errorMessage = getMutationErrorMessage(mutation.error, 'Unable to remove member');

  const form = useScrapsForm({
    ...defaultFormOptions,
    defaultValues: {organizationSlug: ''},
    validators: {onDynamic: removeFromOrgSchema},
    onSubmit: ({value}) => mutation.mutateAsync(value).catch(() => {}),
  });

  return (
    <form.AppForm form={form}>
      <Header closeButton>
        <Heading as="h4">Remove Member from an Organization</Heading>
      </Header>
      <Body>
        <Stack gap="lg">
          <form.AppField name="organizationSlug">
            {field => (
              <field.Layout.Stack
                label="Organization Slug"
                hintText="A unique ID used to identify this organization"
                required
              >
                <field.Input value={field.state.value} onChange={field.handleChange} />
              </field.Layout.Stack>
            )}
          </form.AppField>
          <Text>Note: This action will be recorded in the audit log.</Text>
          {errorMessage && (
            <Alert.Container>
              <Alert variant="danger">{errorMessage}</Alert>
            </Alert.Container>
          )}
        </Stack>
      </Body>
      <Footer>
        <form.SubmitButton>Submit</form.SubmitButton>
      </Footer>
    </form.AppForm>
  );
}

export {AddToOrgModal, RemoveFromOrgModal};
