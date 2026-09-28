import {Fragment, useState} from 'react';
import {useMutation} from '@tanstack/react-query';
import {z} from 'zod';

import {Button} from '@sentry/scraps/button';
import {defaultFormOptions, setFieldErrors, useScrapsForm} from '@sentry/scraps/form';
import {InputGroup} from '@sentry/scraps/input';
import {Flex, Stack} from '@sentry/scraps/layout';

import {addErrorMessage} from 'sentry/actionCreators/indicator';
import type {ModalRenderProps} from 'sentry/actionCreators/modal';
import type {getApiUrl} from 'sentry/utils/api/getApiUrl';
import {fetchMutation} from 'sentry/utils/queryClient';
import {RequestError} from 'sentry/utils/requestError/requestError';
import {requestErrorToFieldErrors} from 'sentry/utils/requestError/requestErrorToFieldErrors';
import {slugify} from 'sentry/utils/slugify';

import type {Policy, PolicyRevision} from 'getsentry/types';

export const policyUrlSchema = z.string().refine(value => {
  if (!value) {
    return true;
  }
  try {
    return ['http:', 'https:'].includes(new URL(value).protocol);
  } catch {
    return false;
  }
}, 'Please enter a valid http or https URL');

const schema = z.object({
  name: z.string(),
  slug: z.string(),
  active: z.boolean(),
  hasSignature: z.boolean(),
  version: z
    .string()
    .refine(
      value => !value || value.length >= 3,
      'Version must be at least 3 characters'
    ),
  url: policyUrlSchema,
  file: z.tuple([z.string(), z.string()]).nullable(),
  current: z.boolean(),
});
type Values = z.infer<typeof schema>;

type Props = ModalRenderProps & {
  apiEndpoint: ReturnType<typeof getApiUrl>;
  isNewPolicy: boolean;
  onSuccess: (data: Policy | PolicyRevision) => void;
  title: string;
  initialVersion?: string;
};

export function PolicyFormModal({
  Body,
  Footer,
  Header,
  closeModal,
  apiEndpoint,
  isNewPolicy,
  onSuccess,
  title,
  initialVersion = '',
}: Props) {
  const [isReadingFile, setIsReadingFile] = useState(false);
  const formSchema = schema.superRefine((value, context) => {
    if (isNewPolicy && !value.name.trim()) {
      context.addIssue({
        code: 'custom',
        path: ['name'],
        message: 'Name is required',
      });
    }
    if (isNewPolicy && !value.slug.trim()) {
      context.addIssue({
        code: 'custom',
        path: ['slug'],
        message: 'Slug is required',
      });
    }
  });
  const mutation = useMutation({
    mutationFn: (data: Partial<Values>) =>
      fetchMutation<Policy | PolicyRevision>({
        url: apiEndpoint,
        method: 'POST',
        data,
      }),
    onSuccess: data => {
      onSuccess(data);
      closeModal();
    },
    onError: error => {
      if (
        error instanceof RequestError &&
        setFieldErrors(form, requestErrorToFieldErrors(error, form.state.values))
      ) {
        return;
      }
      addErrorMessage('Unable to save the policy.');
    },
  });
  const form = useScrapsForm({
    ...defaultFormOptions,
    defaultValues: {
      name: '',
      slug: '',
      active: false,
      hasSignature: false,
      version: initialVersion,
      url: '',
      file: null,
      current: !isNewPolicy,
    } as Values,
    validators: {onDynamic: formSchema},
    onSubmit: ({value}) =>
      mutation
        .mutateAsync(
          isNewPolicy
            ? {
                name: value.name,
                slug: value.slug,
                active: value.active,
                hasSignature: value.hasSignature,
                version: value.version,
                url: value.url,
                ...(value.file ? {file: value.file} : {}),
              }
            : {
                version: value.version,
                url: value.url,
                ...(value.file ? {file: value.file} : {}),
                current: value.current,
              }
        )
        .catch(() => {}),
  });
  return (
    <form.AppForm form={form}>
      <Header closeButton>{title}</Header>
      <Body>
        <Stack gap="lg">
          {isNewPolicy && (
            <Fragment>
              <form.AppField name="name">
                {field => (
                  <field.Layout.Stack label="Name" required>
                    <field.Input
                      value={field.state.value}
                      onChange={field.handleChange}
                      placeholder="e.g. Terms of Service"
                    />
                  </field.Layout.Stack>
                )}
              </form.AppField>
              <form.AppField name="slug">
                {field => (
                  <field.Layout.Stack label="Slug" required>
                    <field.Input
                      value={field.state.value}
                      onChange={value => field.handleChange(slugify(value))}
                      placeholder="e.g. terms-of-service"
                    />
                  </field.Layout.Stack>
                )}
              </form.AppField>
              <form.AppField name="active">
                {field => (
                  <field.Layout.Stack
                    label="Active"
                    hintText="Should this policy be visible to customers?"
                  >
                    <field.Checkbox
                      label="Active"
                      checked={field.state.value}
                      onChange={field.handleChange}
                    />
                  </field.Layout.Stack>
                )}
              </form.AppField>
              <form.AppField name="hasSignature">
                {field => (
                  <field.Layout.Stack
                    label="Has Signature"
                    hintText="Does this policy require the user accept it?"
                  >
                    <field.Checkbox
                      label="Has Signature"
                      checked={field.state.value}
                      onChange={field.handleChange}
                    />
                  </field.Layout.Stack>
                )}
              </form.AppField>
            </Fragment>
          )}
          <form.AppField name="version">
            {field => (
              <field.Layout.Stack label="Version">
                <field.Input
                  value={field.state.value}
                  onChange={field.handleChange}
                  placeholder="e.g. 1.0"
                />
              </field.Layout.Stack>
            )}
          </form.AppField>
          <form.AppField name="url">
            {field => (
              <field.Layout.Stack
                label="URL"
                hintText="If the policy is hosted at an external URL, enter it here."
              >
                <field.Input
                  value={field.state.value}
                  onChange={field.handleChange}
                  placeholder="e.g. https://example.com/terms-of-service/"
                />
              </field.Layout.Stack>
            )}
          </form.AppField>
          <form.AppField name="file">
            {field => (
              <field.Layout.Stack
                label="File"
                hintText="Instead of an external URL you may upload the file directly."
              >
                <InputGroup.Input
                  type="file"
                  accept=".pdf"
                  disabled={mutation.isPending}
                  onChange={event => {
                    const file = event.target.files?.[0];
                    if (!file) {
                      field.handleChange(null);
                      return;
                    }
                    const reader = new FileReader();
                    setIsReadingFile(true);
                    reader.addEventListener('load', () => {
                      field.handleChange([
                        file.name,
                        (reader.result as string).split(',')[1] ?? '',
                      ]);
                      setIsReadingFile(false);
                    });
                    reader.addEventListener('error', () => {
                      setIsReadingFile(false);
                      addErrorMessage('Unable to read the selected file.');
                    });
                    reader.readAsDataURL(file);
                  }}
                />
              </field.Layout.Stack>
            )}
          </form.AppField>
          {!isNewPolicy && (
            <form.AppField name="current">
              {field => (
                <field.Layout.Stack
                  label="Current"
                  hintText="Make this the active version of this policy."
                >
                  <field.Checkbox
                    label="Current"
                    checked={field.state.value}
                    onChange={field.handleChange}
                  />
                </field.Layout.Stack>
              )}
            </form.AppField>
          )}
        </Stack>
      </Body>
      <Footer>
        <Flex gap="md" justify="end">
          <Button onClick={closeModal}>Cancel</Button>
          <form.SubmitButton disabled={isReadingFile}>Save Changes</form.SubmitButton>
        </Flex>
      </Footer>
    </form.AppForm>
  );
}
