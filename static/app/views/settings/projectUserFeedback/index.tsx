import {useEffect} from 'react';
import styled from '@emotion/styled';
import * as Sentry from '@sentry/react';

import Access from 'sentry/components/acl/access';
import {Button} from 'sentry/components/core/button';
import {LinkButton} from 'sentry/components/core/button/linkButton';
import {useOrganizationSeerSetup} from 'sentry/components/events/autofix/useOrganizationSeerSetup';
import Form from 'sentry/components/forms/form';
import JsonForm from 'sentry/components/forms/jsonForm';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import formGroups from 'sentry/data/forms/userFeedback';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import useOrganization from 'sentry/utils/useOrganization';
import SettingsPageHeader from 'sentry/views/settings/components/settingsPageHeader';
import TextBlock from 'sentry/views/settings/components/text/textBlock';
import {ProjectPermissionAlert} from 'sentry/views/settings/project/projectPermissionAlert';
import {useProjectSettingsOutlet} from 'sentry/views/settings/project/projectSettingsLayout';

export default function ProjectUserFeedback() {
  const organization = useOrganization();
  const {project} = useProjectSettingsOutlet();
  const {areAiFeaturesAllowed, setupAcknowledgement} = useOrganizationSeerSetup();
  const hasAiEnabled = areAiFeaturesAllowed && setupAcknowledgement.orgHasAcknowledged;

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

  return (
    <SentryDocumentTitle title={t('User Feedback')} projectSlug={project.slug}>
      <SettingsPageHeader
        title={t('User Feedback')}
        action={
          <ButtonList>
            <LinkButton href="https://docs.sentry.io/product/user-feedback/" external>
              {t('Read the Docs')}
            </LinkButton>
            <Button priority="primary" onClick={handleClick}>
              {t('Open the Crash Report Modal')}
            </Button>
          </ButtonList>
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
      <Form
        saveOnBlur
        apiMethod="PUT"
        apiEndpoint={`/projects/${organization.slug}/${project.slug}/`}
        initialData={project.options}
      >
        <Access access={['project:write']} project={project}>
          {({hasAccess}) => (
            <JsonForm
              disabled={!hasAccess}
              forms={formGroups}
              features={features}
              additionalFieldProps={{hasAiEnabled}}
            />
          )}
        </Access>
      </Form>
    </SentryDocumentTitle>
  );
}

const ButtonList = styled('div')`
  display: inline-grid;
  grid-auto-flow: column;
  gap: ${space(1)};
`;
