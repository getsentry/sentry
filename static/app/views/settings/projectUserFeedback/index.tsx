import {useEffect} from 'react';
import * as Sentry from '@sentry/react';
import {mutationOptions} from '@tanstack/react-query';
import {z} from 'zod';

import {Button, LinkButton} from '@sentry/scraps/button';
import {AutoSaveField, FieldGroup, FormSearch} from '@sentry/scraps/form';
import {Flex} from '@sentry/scraps/layout';
import {ExternalLink} from '@sentry/scraps/link';
import {Text} from '@sentry/scraps/text';

import Access from 'sentry/components/acl/access';
import {AiPrivacyNotice} from 'sentry/components/aiPrivacyTooltip';
import {useOrganizationSeerSetup} from 'sentry/components/events/autofix/useOrganizationSeerSetup';
import {SentryDocumentTitle} from 'sentry/components/sentryDocumentTitle';
import {t, tct} from 'sentry/locale';
import ProjectsStore from 'sentry/stores/projectsStore';
import type {Project} from 'sentry/types/project';
import {fetchMutation} from 'sentry/utils/queryClient';
import {useOrganization} from 'sentry/utils/useOrganization';
import {SettingsPageHeader} from 'sentry/views/settings/components/settingsPageHeader';
import {TextBlock} from 'sentry/views/settings/components/text/textBlock';
import {ProjectPermissionAlert} from 'sentry/views/settings/project/projectPermissionAlert';
import {useProjectSettingsOutlet} from 'sentry/views/settings/project/projectSettingsLayout';

const userFeedbackSchema = z.object({
  'feedback:branding': z.boolean(),
  'sentry:feedback_user_report_notifications': z.boolean(),
  'sentry:feedback_ai_spam_detection': z.boolean(),
});

type UserFeedbackSchema = z.infer<typeof userFeedbackSchema>;

export default function ProjectUserFeedback() {
  const organization = useOrganization();
  const {project} = useProjectSettingsOutlet();
  const {areAiFeaturesAllowed} = useOrganizationSeerSetup();
  const hasAiEnabled = areAiFeaturesAllowed;

  const handleClick = () => {
    Sentry.showReportDialog({
      // should never make it to the Sentry API, but just in case, use throwaway id
      eventId: '00000000000000000000000000000000',
    });
  };

  const features = new Set(organization.features);

  // We need this mock here, otherwise the demo crash modal report will send to Sentry.
  // We also need to unset window.sentryEmbedCallback, otherwise if we get a legit crash modal in our app this code would gobble it up.
  useEffect(() => {
    window.sentryEmbedCallback = function (embed) {
      // Mock the embed's submit xhr to always be successful
      // NOTE: this will not have errors if the form is empty
      embed.submit = function (_body: any) {
        this._submitInProgress = true;
        window.setTimeout(() => {
          this._submitInProgress = false;
          this.onSuccess();
        }, 500);
      };
    };

    return () => {
      window.sentryEmbedCallback = null;
    };
  }, []);

  const projectMutationOptions = mutationOptions({
    mutationFn: (data: Partial<UserFeedbackSchema>) =>
      fetchMutation<Project>({
        url: `/projects/${organization.slug}/${project.slug}/`,
        method: 'PUT',
        data: {options: data},
      }),
    onSuccess: (response: Project) => ProjectsStore.onUpdateSuccess(response),
  });

  const options = project.options ?? {};

  return (
    <FormSearch route="/settings/:orgId/projects/:projectId/user-feedback/">
      <SentryDocumentTitle title={t('User Feedback')} projectSlug={project.slug}>
        <SettingsPageHeader
          title={t('User Feedback')}
          action={
            <Flex gap="md" align="center">
              <LinkButton href="https://docs.sentry.io/product/user-feedback/" external>
                {t('Read the Docs')}
              </LinkButton>
              <Button priority="primary" onClick={handleClick}>
                {t('Open the Crash Report Modal')}
              </Button>
            </Flex>
          }
        />
        <TextBlock>
          {t(
            `Don't rely on stack traces and graphs alone to understand
            the cause and impact of errors. Enable the User Feedback Widget to collect
            your users' comments at anytime, or enable the Crash Report Modal to collect additional context only when an error occurs.`
          )}
        </TextBlock>
        <ProjectPermissionAlert project={project} />

        <Access access={['project:write']} project={project}>
          {({hasAccess}) => (
            <FieldGroup title={t('Settings')}>
              <AutoSaveField
                name="feedback:branding"
                schema={userFeedbackSchema}
                initialValue={Boolean(options['feedback:branding'])}
                mutationOptions={projectMutationOptions}
              >
                {field => (
                  <field.Layout.Row
                    label={t('Show Sentry Branding in Crash Report Modal')}
                    hintText={t(
                      'Show "powered by Sentry" within the Crash Report Modal. We appreciate you helping get the word out about Sentry! <3'
                    )}
                  >
                    <field.Switch
                      checked={field.state.value}
                      onChange={field.handleChange}
                      disabled={!hasAccess}
                    />
                  </field.Layout.Row>
                )}
              </AutoSaveField>

              <AutoSaveField
                name="sentry:feedback_user_report_notifications"
                schema={userFeedbackSchema}
                initialValue={Boolean(
                  options['sentry:feedback_user_report_notifications']
                )}
                mutationOptions={projectMutationOptions}
              >
                {field => (
                  <field.Layout.Stack label={t('Enable Crash Report Notifications')}>
                    <field.Switch
                      checked={field.state.value}
                      onChange={field.handleChange}
                      disabled={!hasAccess}
                    />
                    <Text size="sm" variant="muted">
                      {tct(
                        'Get notified on feedback submissions from the [crashReportModalDocsLink:Crash Report Modal], [webApiEndpointLink:web endpoint], and JS SDK (pre-v8). [feedbackWidgetDocsLink:Feedback widget] notifications are not affected by this setting and are on by default.',
                        {
                          crashReportModalDocsLink: (
                            <ExternalLink href="https://docs.sentry.io/platforms/javascript/user-feedback/#crash-report-modal" />
                          ),
                          feedbackWidgetDocsLink: (
                            <ExternalLink href="https://docs.sentry.io/product/user-feedback/#user-feedback-widget" />
                          ),
                          webApiEndpointLink: (
                            <ExternalLink href="https://docs.sentry.io/api/projects/submit-user-feedback/" />
                          ),
                        }
                      )}
                    </Text>
                  </field.Layout.Stack>
                )}
              </AutoSaveField>

              {features.has('user-feedback-spam-ingest') && hasAiEnabled && (
                <AutoSaveField
                  name="sentry:feedback_ai_spam_detection"
                  schema={userFeedbackSchema}
                  initialValue={Boolean(options['sentry:feedback_ai_spam_detection'])}
                  mutationOptions={projectMutationOptions}
                >
                  {field => (
                    <field.Layout.Stack label={t('Enable Spam Detection')}>
                      <field.Switch
                        checked={field.state.value}
                        onChange={field.handleChange}
                        disabled={!hasAccess}
                      />
                      <Text size="sm" variant="muted">
                        {t(
                          'Toggles whether or not to enable auto spam detection in User Feedback.'
                        )}
                      </Text>
                      <AiPrivacyNotice />
                    </field.Layout.Stack>
                  )}
                </AutoSaveField>
              )}
            </FieldGroup>
          )}
        </Access>
      </SentryDocumentTitle>
    </FormSearch>
  );
}
