import {Fragment} from 'react';

import TextBlock from 'sentry/views/settings/components/text/textBlock';
import Feature from 'sentry/components/acl/feature';
import {ButtonBar} from 'sentry/components/core/button/buttonBar';
import FeedbackButton from 'sentry/components/feedbackButton/feedbackButton';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {t} from 'sentry/locale';
import ProjectsStore from 'sentry/stores/projectsStore';
import SettingsPageHeader from 'sentry/views/settings/components/settingsPageHeader';
import {useProjectSettingsOutlet} from 'sentry/views/settings/project/projectSettingsLayout';
import Access from 'sentry/components/acl/access';
import {ProjectPermissionAlert} from 'sentry/views/settings/project/projectPermissionAlert';
import Form from 'sentry/components/forms/form';
import JsonForm from 'sentry/components/forms/jsonForm';
import useOrganization from 'sentry/utils/useOrganization';
import type {JsonFormObject} from 'sentry/components/forms/types';

const scopeForEdit = 'project:write';


//const defaultInstallSizeAbsoluteDeltaIssueThresholdKb = 500;

export default function PreprodSettings() {
  const organization = useOrganization();
  const {project} = useProjectSettingsOutlet();

  const formGroups: JsonFormObject[] = [
    {
      title: t('Size Analysis Issues'),
      fields: [
        {
          name: 'sentry:preprod_size_issues_is_16kb_ready',
          type: 'boolean',
          label: t('Create 16kb ready issues'),
          help: t('Toggles whether or not to create issues for 16kb readiness.'),
          getData: data => ({options: data}),
        },
        {
          name: 'sentry:preprod_size_issues_delta_install_threshhold_kb',
          type: 'number',
          label: t('Install size regression threshold (kb)'),
          help: t('If there is an regression in install size larger than the threshold an issue will be created.'),
          getData: data => ({options: data}),
        },
      ],
    },
  ];

  return (
    <Fragment>
      <Feature features="organizations:preprod-issues" renderDisabled>
        <SentryDocumentTitle title={t('Preprod')} />
        <SettingsPageHeader
          title={t('Preprod')}
          action={
            <ButtonBar gap="lg">
              <FeedbackButton />
            </ButtonBar>
          }
        />
        <Access access={[scopeForEdit]} project={project}>
          {({hasAccess}) => (
            <Fragment>
              <TextBlock>
                {t(`
                   Configure size analysis and build distribution.
                `)}
              </TextBlock>

              <ProjectPermissionAlert access={[scopeForEdit]} project={project} />

               <Form
                 saveOnBlur
                 apiMethod="PUT"
                 apiEndpoint={`/projects/${organization.slug}/${project.slug}/`}
                 initialData={project.options}
                 onSubmitSuccess={(response) => ProjectsStore.onUpdateSuccess(response)}
               >
                 <JsonForm
                   disabled={!hasAccess}
                   features={new Set(organization.features)}
                   forms={formGroups}
                 />
               </Form>

            </Fragment>
          )}
        </Access>
      </Feature>
    </Fragment>
  );
}
