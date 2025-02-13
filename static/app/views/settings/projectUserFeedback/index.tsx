import {useEffect} from 'react';
import styled from '@emotion/styled';
import * as Sentry from '@sentry/react';

import Access from 'sentry/components/acl/access';
import {Button, LinkButton} from 'sentry/components/button';
import Form from 'sentry/components/forms/form';
import JsonForm from 'sentry/components/forms/jsonForm';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import formGroups from 'sentry/data/forms/userFeedback';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {RouteComponentProps} from 'sentry/types/legacyReactRouter';
import type {Organization} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';
import withOrganization from 'sentry/utils/withOrganization';
import SettingsPageHeader from 'sentry/views/settings/components/settingsPageHeader';
import TextBlock from 'sentry/views/settings/components/text/textBlock';
import {ProjectPermissionAlert} from 'sentry/views/settings/project/projectPermissionAlert';

type RouteParams = {
  projectId: string;
};
type Props = RouteComponentProps<RouteParams, {}> & {
  organization: Organization;
  project: Project;
};

function ProjectUserFeedback({organization, project, params: {projectId}}: Props) {
  const handleClick = () => {
    Sentry.showReportDialog({
      // should never make it to the Sentry API, but just in case, use throwaway id
      eventId: '00000000000000000000000000000000',
    });
  };

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
      <ProjectPermissionAlert margin={false} project={project} />
      <Form
        saveOnBlur
        apiMethod="PUT"
        apiEndpoint={`/projects/${organization.slug}/${projectId}/`}
        initialData={project.options}
      >
        <Access access={['project:write']} project={project}>
          {({hasAccess}) => <JsonForm disabled={!hasAccess} forms={formGroups} />}
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

export default withOrganization(ProjectUserFeedback);
