import {useMutation} from '@tanstack/react-query';
import {z} from 'zod';

import {defaultFormValidators, ScrapsForm, useScrapsForm} from '@sentry/scraps/form';
import {Stack} from '@sentry/scraps/layout';
import {Heading, Text} from '@sentry/scraps/text';

import {addErrorMessage} from 'sentry/actionCreators/indicator';
import type {ModalRenderProps} from 'sentry/actionCreators/modal';
import {ORG_ROLES} from 'sentry/constants';
import {getApiUrl} from 'sentry/utils/api/getApiUrl';
import {fetchMutation} from 'sentry/utils/queryClient';
import {RequestError} from 'sentry/utils/requestError/requestError';
import {testableWindowLocation} from 'sentry/utils/testableWindowLocation';

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
      testableWindowLocation.reload();
    },
    onError: error => {
      const detail =
        error instanceof RequestError ? error.responseJSON?.detail : undefined;
      addErrorMessage(typeof detail === 'string' ? detail : 'Unable to add member');
    },
  });

  const form = useScrapsForm({
    defaultValues: {organizationSlug: '', role: ''},
    validators: defaultFormValidators(addToOrgSchema),
    onSubmit: ({value}) =>
      mutation.mutateAsync(addToOrgSchema.parse(value)).catch(() => {}),
  });

  return (
    <ScrapsForm form={form}>
      <Header closeButton>
        <Heading as="h4">Add Member to an Organization</Heading>
      </Header>
      <Body>
        <Stack gap="lg">
          <form.Field name="organizationSlug">
            {field => (
              <field.Layout.Stack
                label="Organization Slug"
                hintText="A unique ID used to identify this organization"
                required
              >
                <field.Input value={field.value} onChange={field.handleChange} />
              </field.Layout.Stack>
            )}
          </form.Field>
          <form.Field name="role">
            {field => (
              <field.Layout.Stack label="Role" required>
                <field.Select
                  value={field.value}
                  onChange={field.handleChange}
                  options={ORG_ROLES.map(role => ({
                    value: role.id,
                    label: role.name,
                  }))}
                  placeholder="Choose a role"
                />
              </field.Layout.Stack>
            )}
          </form.Field>
          <Text>Note: This action will be recorded in the audit log.</Text>
        </Stack>
      </Body>
      <Footer>
        <form.SubmitButton>Submit</form.SubmitButton>
      </Footer>
    </ScrapsForm>
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
      testableWindowLocation.reload();
    },
    onError: error => {
      const detail =
        error instanceof RequestError ? error.responseJSON?.detail : undefined;
      addErrorMessage(typeof detail === 'string' ? detail : 'Unable to remove member');
    },
  });

  const form = useScrapsForm({
    defaultValues: {organizationSlug: ''},
    validators: defaultFormValidators(removeFromOrgSchema),
    onSubmit: ({value}) =>
      mutation.mutateAsync(removeFromOrgSchema.parse(value)).catch(() => {}),
  });

  return (
    <ScrapsForm form={form}>
      <Header closeButton>
        <Heading as="h4">Remove Member from an Organization</Heading>
      </Header>
      <Body>
        <Stack gap="lg">
          <form.Field name="organizationSlug">
            {field => (
              <field.Layout.Stack
                label="Organization Slug"
                hintText="A unique ID used to identify this organization"
                required
              >
                <field.Input value={field.value} onChange={field.handleChange} />
              </field.Layout.Stack>
            )}
          </form.Field>
          <Text>Note: This action will be recorded in the audit log.</Text>
        </Stack>
      </Body>
      <Footer>
        <form.SubmitButton>Submit</form.SubmitButton>
      </Footer>
    </ScrapsForm>
  );
}

export {AddToOrgModal, RemoveFromOrgModal};
