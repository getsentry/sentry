import {useMutation} from '@tanstack/react-query';
import {z} from 'zod';

import {Alert} from '@sentry/scraps/alert';
import {Button} from '@sentry/scraps/button';
import {defaultFormOptions, useScrapsForm} from '@sentry/scraps/form';
import {Flex, Stack} from '@sentry/scraps/layout';
import {ExternalLink} from '@sentry/scraps/link';
import {Text} from '@sentry/scraps/text';

import {addErrorMessage, addSuccessMessage} from 'sentry/actionCreators/indicator';
import type {ModalRenderProps} from 'sentry/actionCreators/modal';
import {INTEGRATION_CATEGORIES} from 'sentry/components/modals/sentryAppPublishRequestModal/sentryAppUtils';
import {t, tct} from 'sentry/locale';
import type {SentryApp} from 'sentry/types/integrations';
import type {Organization} from 'sentry/types/organization';
import {fetchMutation} from 'sentry/utils/queryClient';
import {RequestError} from 'sentry/utils/requestError/requestError';
import {safeURL} from 'sentry/utils/url/safeURL';

const urlValidation = z
  .string()
  .min(1, t('Field is required'))
  .pipe(z.string().refine(value => Boolean(safeURL(value)), t('Enter a valid URL')));

const schema = z.object({
  question0: z.string().min(1, t('Field is required')),
  question1: z.string().min(1, t('Field is required')),
  question2: z
    .string()
    .nullable()
    .refine(value => value !== null, t('Field is required')),
  question3: urlValidation,
  supportEmail: z
    .string()
    .min(1, t('Field is required'))
    .pipe(z.email(t('Enter a valid email address'))),
  question4: urlValidation,
});

type FormValues = z.input<typeof schema>;

// No translations since we need to be able to read these questions :)
const QUESTIONS: ReadonlyArray<{name: keyof FormValues; question: string}> = [
  {
    name: 'question0',
    question:
      'Provide a description about your integration, how this benefits developers using Sentry along with what’s needed to set up this integration.',
  },
  {
    name: 'question1',
    question:
      'Provide a one-liner describing your integration. Subject to approval, we’ll use this to describe your integration on Sentry Integrations.',
  },
  {
    name: 'question2',
    question: 'Select what category best describes your integration.',
  },
  {
    name: 'question3',
    question: 'Link to your documentation page.',
  },
  {
    name: 'supportEmail',
    question: 'Email address for user support.',
  },
  {
    name: 'question4',
    question:
      'Link to a video showing installation, setup and user flow for your submission.',
  },
];

const CATEGORY_OPTIONS = INTEGRATION_CATEGORIES.map(([value, label]) => ({
  value,
  label,
}));

type Props = ModalRenderProps & {
  app: SentryApp;
  onPublishSubmission: () => void;
  organization: Organization;
};

export function SentryAppPublishRequestModal({
  app,
  closeModal,
  Header,
  Body,
  Footer,
  onPublishSubmission,
}: Props) {
  const {mutateAsync: submitPublishRequest} = useMutation({
    mutationFn: (data: {questionnaire: Array<{answer: string; question: string}>}) =>
      fetchMutation({
        method: 'POST',
        url: `/sentry-apps/${app.slug}/publish-request/`,
        data,
      }),
    onSuccess: () => {
      addSuccessMessage(t('Request to publish %s successful.', app.slug));
      closeModal();
      onPublishSubmission();
    },
    onError: error => {
      const rawDetail =
        error instanceof RequestError ? error.responseJSON?.detail : undefined;
      const detail = typeof rawDetail === 'string' ? rawDetail : rawDetail?.message;
      addErrorMessage(
        detail
          ? tct('Request to publish [app] fails. [detail]', {app: app.slug, detail})
          : t('Request to publish %s fails.', app.slug)
      );
    },
  });

  const defaultValues: FormValues = {
    question0: '',
    question1: '',
    question2: null,
    question3: '',
    supportEmail: '',
    question4: '',
  };

  const form = useScrapsForm({
    ...defaultFormOptions,
    defaultValues,
    validators: {onDynamic: schema},
    onSubmit: ({value}) => {
      const parsed = schema.parse(value);
      const questionnaire = QUESTIONS.map(({name, question}) => ({
        question,
        answer: String(parsed[name] ?? ''),
      }));
      return submitPublishRequest({questionnaire}).catch(() => {});
    },
  });

  return (
    <form.AppForm form={form}>
      <Header>
        <h1>{t('Publish Request Questionnaire')}</h1>
      </Header>
      <Body>
        <Stack gap="xl">
          <Text as="p">
            {t(
              `Please fill out this questionnaire in order to get your integration evaluated for publication.
              Once your integration has been approved, users outside of your organization will be able to install it.`
            )}
          </Text>

          <form.AppField name="question0">
            {field => (
              <field.Layout.Stack
                label={t(
                  'Provide a description about your integration, how this benefits developers using Sentry along with what’s needed to set up this integration.'
                )}
                required
              >
                <field.TextArea
                  autosize
                  rows={3}
                  value={field.state.value}
                  onChange={field.handleChange}
                />
              </field.Layout.Stack>
            )}
          </form.AppField>

          <form.AppField name="question1">
            {field => (
              <field.Layout.Stack
                label={tct(
                  'Provide a one-liner describing your integration. Subject to approval, we’ll use this to describe your integration on [link:Sentry Integrations].',
                  {
                    link: <ExternalLink href="https://sentry.io/integrations/" />,
                  }
                )}
                required
              >
                <field.TextArea
                  autosize
                  rows={3}
                  value={field.state.value}
                  onChange={field.handleChange}
                />
              </field.Layout.Stack>
            )}
          </form.AppField>

          <form.AppField name="question2">
            {field => (
              <field.Layout.Stack
                label={tct(
                  'Select what category best describes your integration. [link:Documentation for reference.]',
                  {
                    link: (
                      <ExternalLink href="https://docs.sentry.io/organization/integrations/" />
                    ),
                  }
                )}
                required
              >
                <field.Select
                  options={CATEGORY_OPTIONS}
                  value={field.state.value}
                  onChange={field.handleChange}
                />
              </field.Layout.Stack>
            )}
          </form.AppField>

          <form.AppField name="question3">
            {field => (
              <field.Layout.Stack label={t('Link to your documentation page.')} required>
                <field.Input
                  type="url"
                  value={field.state.value}
                  onChange={field.handleChange}
                />
              </field.Layout.Stack>
            )}
          </form.AppField>

          <form.AppField name="supportEmail">
            {field => (
              <field.Layout.Stack label={t('Email address for user support.')} required>
                <field.Input
                  type="email"
                  value={field.state.value}
                  onChange={field.handleChange}
                />
              </field.Layout.Stack>
            )}
          </form.AppField>

          <form.AppField name="question4">
            {field => (
              <field.Layout.Stack
                label={t(
                  'Link to a video showing installation, setup and user flow for your submission.'
                )}
                required
              >
                <field.Input
                  type="url"
                  value={field.state.value}
                  onChange={field.handleChange}
                />
              </field.Layout.Stack>
            )}
          </form.AppField>

          <Alert variant="info">
            <Stack gap="lg">
              <Text as="p">
                {t(
                  'By submitting your integration, you acknowledge and agree that Sentry reserves the right to remove your integration at any time in its sole discretion.'
                )}
              </Text>
              <Text as="p">
                {t(
                  'After submission, our team will review your integration to ensure it meets our guidelines. Our current processing time for integration publishing requests is 4 weeks. You’ll hear from us once the integration is approved or if any changes are required.'
                )}
              </Text>
              <Text as="p">
                {t(
                  'You must notify Sentry of any changes or modifications to the integration after publishing. We encourage you to maintain a changelog of modifications on your docs page.'
                )}
              </Text>
              <Text as="p">
                {t('Thank you for contributing to the Sentry community!')}
              </Text>
            </Stack>
          </Alert>
        </Stack>
      </Body>
      <Footer>
        <Flex gap="md">
          <Button onClick={closeModal}>{t('Cancel')}</Button>
          <form.SubmitButton>{t('Request Publication')}</form.SubmitButton>
        </Flex>
      </Footer>
    </form.AppForm>
  );
}
