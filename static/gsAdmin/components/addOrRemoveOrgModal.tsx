import {useMutation} from '@tanstack/react-query';
import {z} from 'zod';

import {defaultFormOptions, useScrapsForm} from '@sentry/scraps/form';
import {Stack} from '@sentry/scraps/layout';
import {Heading, Text} from '@sentry/scraps/text';

import {addErrorMessage} from 'sentry/actionCreators/indicator';
import type {ModalRenderProps} from 'sentry/actionCreators/modal';
import {ORG_ROLES} from 'sentry/constants';
import {getApiUrl} from 'sentry/utils/api/getApiUrl';
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
  organizationSlug: z.string().trim().min(1, 'Organization slug is required'),
  role: z.string().trim().min(1, 'Role is required'),
});

const removeFromOrgSchema = z.object({
  organizationSlug: z.string().trim().min(1, 'Organization slug is required'),
});

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
        url: getApiUrl('/customers/$organizationIdOrSlug/users/$userId/members/', {
          path: {organizationIdOrSlug: data.organizationSlug, userId},
        }),
        method: 'POST',
        data: {orgRole: data.role},
      }),
    onSuccess: () => {
      closeModal();
      window.location.reload();
    },
    onError: error => {
      const detail =
        error instanceof RequestError ? error.responseJSON?.detail : undefined;
      addErrorMessage(typeof detail === 'string' ? detail : 'Unable to add member');
    },
  });

  const form = useScrapsForm({
    ...defaultFormOptions,
    defaultValues: {organizationSlug: '', role: ''},
    validators: {onDynamic: addToOrgSchema},
    onSubmit: ({value}) =>
      mutation.mutateAsync(addToOrgSchema.parse(value)).catch(() => {}),
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
        url: getApiUrl('/customers/$organizationIdOrSlug/users/$userId/members/', {
          path: {organizationIdOrSlug: data.organizationSlug, userId},
        }),
        method: 'DELETE',
      }),
    onSuccess: () => {
      closeModal();
      window.location.reload();
    },
    onError: error => {
      const detail =
        error instanceof RequestError ? error.responseJSON?.detail : undefined;
      addErrorMessage(typeof detail === 'string' ? detail : 'Unable to remove member');
    },
  });

  const form = useScrapsForm({
    ...defaultFormOptions,
    defaultValues: {organizationSlug: ''},
    validators: {onDynamic: removeFromOrgSchema},
    onSubmit: ({value}) =>
      mutation.mutateAsync(removeFromOrgSchema.parse(value)).catch(() => {}),
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
        </Stack>
      </Body>
      <Footer>
        <form.SubmitButton>Submit</form.SubmitButton>
      </Footer>
    </form.AppForm>
  );
}

export {AddToOrgModal, RemoveFromOrgModal};
