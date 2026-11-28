import {useMutation} from '@tanstack/react-query';
import {z} from 'zod';

import {Button} from '@sentry/scraps/button';
import {defaultFormOptions, setFieldErrors, useScrapsForm} from '@sentry/scraps/form';
import {Flex, Stack} from '@sentry/scraps/layout';
import {toast} from '@sentry/scraps/toast';

import {t} from 'sentry/locale';
import type {Project} from 'sentry/types/project';
import {trackAnalytics} from 'sentry/utils/analytics';
import {getApiUrl} from 'sentry/utils/api/getApiUrl';
import {fetchMutation} from 'sentry/utils/queryClient';
import {getRequestErrorUserMessage} from 'sentry/utils/requestError/getRequestErrorUserMessage';
import {RequestError} from 'sentry/utils/requestError/requestError';
import {requestErrorToFieldErrors} from 'sentry/utils/requestError/requestErrorToFieldErrors';
import {useOrganization} from 'sentry/utils/useOrganization';

import type {Attribute} from './projectAttributesCommon';

const MAX_BRIEF_LENGTH = 280;

const schema = z.object({
  brief: z
    .string()
    .max(
      MAX_BRIEF_LENGTH,
      t('Keep the description under %s characters.', MAX_BRIEF_LENGTH)
    ),
  additionalContext: z.string(),
  examples: z.string(),
});

interface AttributeContextPayload {
  additionalContext: string;
  brief: string;
  examples: string[];
}

interface SavedAttributeContext {
  additionalContext: string | null;
  brief: string | null;
  examples: string[];
}

function toAttributeContext(saved: SavedAttributeContext): Attribute['context'] {
  const context: NonNullable<Attribute['context']> = {};
  if (saved.brief) {
    context.brief = saved.brief;
  }
  if (saved.additionalContext) {
    context.details = [saved.additionalContext];
  }
  if (saved.examples.length) {
    context.examples = saved.examples;
  }
  return Object.keys(context).length
    ? {...context, isCustom: true, isProjectScoped: true}
    : {};
}

function parseExamples(examples: string) {
  return [
    ...new Set(
      examples
        .split('\n')
        .map(example => example.trim())
        .filter(Boolean)
    ),
  ];
}

export function ProjectAttributeMetadataForm({
  attribute,
  project,
  onCancel,
  onSave,
}: {
  attribute: Attribute;
  onCancel: () => void;
  onSave: (context: Attribute['context']) => void;
  project: Project;
}) {
  const organization = useOrganization();
  const {context} = attribute;

  const mutation = useMutation({
    mutationFn: (payload: AttributeContextPayload) =>
      fetchMutation<{contexts: SavedAttributeContext[]}>({
        url: getApiUrl(
          '/organizations/$organizationIdOrSlug/trace-items/attributes/$key/context/',
          {path: {organizationIdOrSlug: organization.slug, key: attribute.name}}
        ),
        method: 'PUT',
        options: {query: {project: project.id}},
        data: {
          datasets: attribute.datasets,
          attributeType: attribute.attributeType,
          ...payload,
        },
      }),
    onSuccess: ({contexts}) => {
      trackAnalytics('settings.attribute_metadata.changed', {
        organization,
        attribute_type: attribute.attributeType,
      });
      toast.success(t('Saved attribute metadata.'));
      const [saved] = contexts;
      onSave(saved ? toAttributeContext(saved) : {});
    },
  });

  const savedExamples = context?.examples?.map(String) ?? [];
  const defaultValues = {
    brief: context?.brief ?? '',
    additionalContext: context?.details?.join('\n\n') ?? '',
    examples: savedExamples.join('\n'),
  };

  const form = useScrapsForm({
    ...defaultFormOptions,
    defaultValues,
    validators: {onDynamic: schema},
    onSubmit: ({value, formApi}) => {
      const examples = parseExamples(value.examples);
      const examplesChanged =
        examples.join('\n') !== parseExamples(defaultValues.examples).join('\n');
      const payload = {
        brief: value.brief.trim(),
        additionalContext: value.additionalContext.trim(),
        examples: examplesChanged ? examples : savedExamples,
      };
      if (
        !examplesChanged &&
        payload.brief === defaultValues.brief.trim() &&
        payload.additionalContext === defaultValues.additionalContext.trim()
      ) {
        onCancel();
        return;
      }
      return mutation.mutateAsync(payload).catch(error => {
        const fieldErrors =
          error instanceof RequestError
            ? requestErrorToFieldErrors(error, formApi.state.values)
            : {};
        if (Object.keys(fieldErrors).length) {
          setFieldErrors(formApi, fieldErrors);
        } else {
          toast.error(
            getRequestErrorUserMessage(error, t('Failed to save attribute metadata.'))
          );
        }
      });
    },
  });

  return (
    <form.AppForm form={form}>
      <Stack gap="lg">
        <form.AppField name="brief">
          {field => (
            <field.Layout.Stack label={t('Description')}>
              <field.Input
                value={field.state.value}
                onChange={field.handleChange}
                maxLength={MAX_BRIEF_LENGTH}
                autoFocus
              />
            </field.Layout.Stack>
          )}
        </form.AppField>
        <form.AppField name="additionalContext">
          {field => (
            <field.Layout.Stack label={t('Notes')} hintText={t('Supports Markdown.')}>
              <field.TextArea
                value={field.state.value}
                onChange={field.handleChange}
                rows={4}
              />
            </field.Layout.Stack>
          )}
        </form.AppField>
        <form.AppField name="examples">
          {field => (
            <field.Layout.Stack
              label={t('Examples')}
              hintText={t('One example per line.')}
            >
              <field.TextArea
                value={field.state.value}
                onChange={field.handleChange}
                rows={3}
              />
            </field.Layout.Stack>
          )}
        </form.AppField>
        <Flex gap="md" justify="end">
          <form.Subscribe selector={state => state.isSubmitting}>
            {isSubmitting => (
              <Button disabled={isSubmitting} onClick={onCancel}>
                {t('Cancel')}
              </Button>
            )}
          </form.Subscribe>
          <form.SubmitButton>{t('Save')}</form.SubmitButton>
        </Flex>
      </Stack>
    </form.AppForm>
  );
}
