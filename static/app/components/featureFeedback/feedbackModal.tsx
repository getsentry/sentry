import {useMemo} from 'react';
import {css} from '@emotion/react';
import {
  BrowserClient,
  captureFeedback,
  defaultStackParser,
  getDefaultIntegrations,
  makeFetchTransport,
} from '@sentry/react';
import {useQueryState} from 'nuqs';
import {z} from 'zod';
import {useStore} from 'zustand';

import {Alert} from '@sentry/scraps/alert';
import {Button} from '@sentry/scraps/button';
import {defaultFormOptions, useScrapsForm} from '@sentry/scraps/form';
import {Container, Grid, Stack} from '@sentry/scraps/layout';
import {ExternalLink} from '@sentry/scraps/link';
import type {ModalRenderProps} from '@sentry/scraps/modal';
import {toast} from '@sentry/scraps/toast';

import {t, tct} from 'sentry/locale';
import {ConfigStore} from 'sentry/stores/configStore';
import {OrganizationStore} from 'sentry/stores/organizationStore';
import {pageFilterParsers} from 'sentry/utils/url/pageFilterParsers';
import {useProjects} from 'sentry/utils/useProjects';
import {useUser} from 'sentry/utils/useUser';

const feedbackClient = new BrowserClient({
  // feedback project under Sentry organization
  dsn: 'https://3c5ef4e344a04a0694d187a1272e96de@o1.ingest.sentry.io/6356259',
  transport: makeFetchTransport,
  stackParser: defaultStackParser,
  integrations: getDefaultIntegrations({}),
});

const defaultFeedbackTypes = [
  t("I don't like this feature"),
  t('I like this feature'),
  t('Other reason'),
];

const schema = z.object({
  subject: z
    .number()
    .nullable()
    .refine(value => value !== null, t('Required fields must be filled out')),
  additionalInfo: z.string(),
});

export type FeedbackModalProps = {
  featureName: string;
  feedbackTypes?: string[];
  secondaryAction?: React.ReactNode;
  /** Use the actual user feedback feature instead of simply creating a message event. */
  useNewUserFeedback?: boolean;
};

/**
 * A modal that allows users to submit feedback to Sentry (feedbacks project).
 *
 * @deprecated Use `<FeedbackButton/>` instead.
 */
export function FeedbackModal({
  Header,
  Body,
  Footer,
  closeModal,
  featureName,
  feedbackTypes = defaultFeedbackTypes,
  secondaryAction,
  useNewUserFeedback,
}: FeedbackModalProps & ModalRenderProps) {
  const organization = useStore(OrganizationStore, state => state.organization);
  const {projects, initiallyLoaded: projectsLoaded} = useProjects();
  const [projectIds] = useQueryState('project', pageFilterParsers.project);

  const user = useUser();
  const isSelfHosted = ConfigStore.get('isSelfHosted');

  const project = useMemo(() => {
    if (projectsLoaded && projectIds.length === 1) {
      return projects.find(p => p.id === projectIds[0]);
    }
    return;
  }, [projectsLoaded, projects, projectIds]);

  const defaultValues: z.input<typeof schema> = {subject: null, additionalInfo: ''};

  const form = useScrapsForm({
    ...defaultFormOptions,
    defaultValues,
    validators: {onDynamic: schema},
    onSubmit: ({value}) => {
      const {subject, additionalInfo} = schema.parse(value);
      const message = `${featureName} feedback by ${user.email}`;
      const hasAdditionalInfo = additionalInfo.trim() !== '';
      const fullMessage = hasAdditionalInfo
        ? `${message} - ${feedbackTypes[subject]} - ${additionalInfo}`
        : `${message} - ${feedbackTypes[subject]}`;

      if (useNewUserFeedback) {
        captureFeedback({
          message: fullMessage,
          source: featureName,
          tags: {feature: featureName},
        });
      } else {
        feedbackClient.captureEvent({
          message: fullMessage,
          request: {
            url: window.location.href, // gives the full url (origin + pathname)
          },
          extra: {
            orgFeatures: organization?.features ?? [],
            orgAccess: organization?.access ?? [],
            projectFeatures: project?.features ?? [],
          },
          tags: {featureName},
          user,
          level: 'info',
          contexts: {
            feedback: {additionalInfo: hasAdditionalInfo ? additionalInfo : null},
          },
        });
      }

      toast.success(t('Thanks for taking the time to provide us feedback!'));
      closeModal();
    },
  });

  return (
    <form.AppForm form={form}>
      <Header closeButton>
        <h3>{t('Submit Feedback')}</h3>
      </Header>
      <Body>
        <Stack gap="xl">
          <form.AppField name="subject">
            {field => (
              <field.Layout.Stack label={t('Type of feedback')} required>
                <field.Select
                  value={field.state.value}
                  onChange={field.handleChange}
                  options={feedbackTypes.map((feedbackType, index) => ({
                    value: index,
                    label: feedbackType,
                  }))}
                  placeholder={t('Select type of feedback')}
                />
              </field.Layout.Stack>
            )}
          </form.AppField>
          <form.AppField name="additionalInfo">
            {field => (
              <field.Layout.Stack label={t('Additional feedback')}>
                <field.TextArea
                  value={field.state.value}
                  onChange={field.handleChange}
                  rows={5}
                  autosize
                  placeholder={t('What did you expect?')}
                />
              </field.Layout.Stack>
            )}
          </form.AppField>
          {isSelfHosted && (
            <Alert variant="info" showIcon={false}>
              {tct(
                "You agree that any feedback you submit is subject to Sentry's [privacyPolicy:Privacy Policy] and Sentry may use such feedback without restriction or obligation.",
                {privacyPolicy: <ExternalLink href="https://sentry.io/privacy/" />}
              )}
            </Alert>
          )}
        </Stack>
      </Body>
      <Footer>
        {secondaryAction && (
          <Container flex="1" alignSelf="center">
            {secondaryAction}
          </Container>
        )}
        <Grid flow="column" align="center" gap="md">
          <Button onClick={closeModal}>{t('Cancel')}</Button>
          <form.Subscribe selector={state => state.values.subject === null}>
            {isMissingSubject => (
              <form.SubmitButton
                disabled={isMissingSubject}
                tooltipProps={{
                  title: isMissingSubject
                    ? t('Required fields must be filled out')
                    : undefined,
                }}
              >
                {t('Submit')}
              </form.SubmitButton>
            )}
          </form.Subscribe>
        </Grid>
      </Footer>
    </form.AppForm>
  );
}

export const modalCss = css`
  width: 100%;
  max-width: 680px;
`;
