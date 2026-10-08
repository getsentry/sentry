import {Fragment, useRef, useState} from 'react';
import {useMutation} from '@tanstack/react-query';
import {z} from 'zod';

import {Button} from '@sentry/scraps/button';
import {useScrapsForm, ScrapsForm, defaultFormValidators} from '@sentry/scraps/form';
import {Flex, Stack} from '@sentry/scraps/layout';
import {Heading, Text} from '@sentry/scraps/text';

import {addErrorMessage} from 'sentry/actionCreators/indicator';
import type {ModalRenderProps} from 'sentry/actionCreators/modal';
import {IconClose} from 'sentry/icons';
import {getApiUrl} from 'sentry/utils/api/getApiUrl';
import {fetchMutation} from 'sentry/utils/queryClient';
import {readFileAsBase64} from 'sentry/utils/readFileAsBase64';
import {RequestError} from 'sentry/utils/requestError/requestError';
import {requestErrorToFieldErrors} from 'sentry/utils/requestError/requestErrorToFieldErrors';
import {slugify} from 'sentry/utils/slugify';

import type {Policy, PolicyRevision} from 'getsentry/types';

const baseSchema = z.object({
  name: z.string(),
  slug: z.string(),
  active: z.boolean(),
  hasSignature: z.boolean(),
  version: z.union([
    z.literal(''),
    z.string().min(3, 'Version must be at least 3 characters'),
  ]),
  url: z.union([
    z.literal(''),
    z.url({protocol: /^https?$/, error: 'Please enter a valid http or https URL'}),
  ]),
  file: z.tuple([z.string(), z.string()]).nullable(),
  current: z.boolean(),
});
const policySchema = baseSchema.extend({
  name: z.string().trim().min(1, 'Name is required'),
  slug: z.string().trim().min(1, 'Slug is required'),
});
const revisionSchema = baseSchema.extend({
  version: z
    .string()
    .trim()
    .min(1, 'Version is required')
    .min(3, 'Version must be at least 3 characters'),
});
type Values = z.infer<typeof baseSchema>;

type Props = ModalRenderProps & {
  onSuccess: (data: Policy | PolicyRevision) => void;
  title: string;
  initialVersion?: string;
} & ({isNewPolicy: true; policySlug?: never} | {isNewPolicy: false; policySlug: string});

export function PolicyFormModal({
  Body,
  Footer,
  Header,
  closeModal,
  isNewPolicy,
  policySlug,
  onSuccess,
  title,
  initialVersion = '',
}: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isReadingFile, setIsReadingFile] = useState(false);
  const mutation = useMutation({
    mutationFn: fetchMutation<Policy | PolicyRevision>,
    onSuccess: data => {
      onSuccess(data);
      closeModal();
    },
  });
  const form = useScrapsForm({
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
    validators: defaultFormValidators(isNewPolicy ? policySchema : revisionSchema),
    onSubmit: ({value, createValidationError}) => {
      if (isReadingFile) {
        addErrorMessage('Please wait for the selected file to finish loading.');
        return;
      }
      return mutation
        .mutateAsync({
          url: isNewPolicy
            ? getApiUrl('/policies/')
            : getApiUrl('/policies/$policySlug/revisions/', {
                path: {policySlug},
              }),
          method: 'POST',
          data: isNewPolicy
            ? {
                name: value.name,
                slug: value.slug,
                active: value.active,
                hasSignature: value.hasSignature,
                ...(value.version ? {version: value.version} : {}),
                ...(value.url ? {url: value.url} : {}),
                ...(value.file ? {file: value.file} : {}),
              }
            : {
                version: value.version,
                ...(value.url ? {url: value.url} : {}),
                ...(value.file ? {file: value.file} : {}),
                current: value.current,
              },
        })
        .catch(error => {
          if (error instanceof RequestError) {
            const fields = requestErrorToFieldErrors(error, value);
            if (fields) {
              return createValidationError({fields});
            }
          }
          addErrorMessage('Unable to save the policy.');
          return;
        });
    },
  });
  return (
    <ScrapsForm form={form}>
      <Header closeButton>
        <Heading as="h3">{title}</Heading>
      </Header>
      <Body>
        <Stack gap="lg">
          {isNewPolicy && (
            <Fragment>
              <form.Field name="name">
                {field => (
                  <field.Layout.Stack label="Name" required>
                    <field.Input
                      value={field.value}
                      onChange={field.handleChange}
                      placeholder="e.g. Terms of Service"
                    />
                  </field.Layout.Stack>
                )}
              </form.Field>
              <form.Field name="slug">
                {field => (
                  <field.Layout.Stack label="Slug" required>
                    <field.Input
                      value={field.value}
                      onChange={value => field.handleChange(slugify(value))}
                      placeholder="e.g. terms-of-service"
                    />
                  </field.Layout.Stack>
                )}
              </form.Field>
              <form.Field name="active">
                {field => (
                  <field.Checkbox
                    label="Active"
                    hintText="Should this policy be visible to customers?"
                    checked={field.value}
                    onChange={field.handleChange}
                  />
                )}
              </form.Field>
              <form.Field name="hasSignature">
                {field => (
                  <field.Checkbox
                    label="Has Signature"
                    hintText="Does this policy require the user accept it?"
                    checked={field.value}
                    onChange={field.handleChange}
                  />
                )}
              </form.Field>
            </Fragment>
          )}
          <form.Field name="version">
            {field => (
              <field.Layout.Stack label="Version" required={!isNewPolicy}>
                <field.Input
                  value={field.value}
                  onChange={field.handleChange}
                  placeholder="e.g. 1.0"
                />
              </field.Layout.Stack>
            )}
          </form.Field>
          <form.Field name="url">
            {field => (
              <field.Layout.Stack
                label="URL"
                hintText="A revision needs either a URL or a PDF file."
              >
                <field.Input
                  value={field.value}
                  onChange={field.handleChange}
                  placeholder="e.g. https://example.com/terms-of-service/"
                />
              </field.Layout.Stack>
            )}
          </form.Field>
          <form.Field name="file">
            {field => (
              <field.Layout.Stack
                label="File"
                hintText="Upload a PDF instead of entering a URL."
              >
                <Flex align="center" gap="md">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".pdf"
                    hidden
                    style={{display: 'none'}}
                    onChange={event => {
                      const file = event.target.files?.[0];
                      if (!file) {
                        field.handleChange(null);
                        return;
                      }
                      setIsReadingFile(true);
                      readFileAsBase64(
                        file,
                        content => {
                          field.handleChange([file.name, content ?? '']);
                          setIsReadingFile(false);
                        },
                        () => {
                          setIsReadingFile(false);
                          addErrorMessage('Unable to read the selected file.');
                        }
                      );
                    }}
                  />
                  <Button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={mutation.isPending}
                  >
                    Choose File
                  </Button>
                  <Text variant="muted" ellipsis>
                    {isReadingFile
                      ? 'Reading file…'
                      : (field.value?.[0] ?? 'No file selected')}
                  </Text>
                  {field.value && (
                    <Button
                      variant="transparent"
                      size="xs"
                      icon={<IconClose size="xs" aria-hidden />}
                      aria-label="Remove file"
                      disabled={mutation.isPending}
                      onClick={() => {
                        if (fileInputRef.current) {
                          fileInputRef.current.value = '';
                        }
                        field.handleChange(null);
                      }}
                    />
                  )}
                </Flex>
              </field.Layout.Stack>
            )}
          </form.Field>
          {!isNewPolicy && (
            <form.Field name="current">
              {field => (
                <field.Checkbox
                  label="Current"
                  hintText="Make this the active version of this policy."
                  checked={field.value}
                  onChange={field.handleChange}
                />
              )}
            </form.Field>
          )}
        </Stack>
      </Body>
      <Footer>
        <Flex gap="md" justify="end">
          <Button onClick={closeModal}>Cancel</Button>
          <form.SubmitButton>Save Changes</form.SubmitButton>
        </Flex>
      </Footer>
    </ScrapsForm>
  );
}
