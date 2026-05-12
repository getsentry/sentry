import {Access} from 'sentry/components/acl/access';
import {BooleanField} from 'sentry/components/forms/fields/booleanField';
import {Form} from 'sentry/components/forms/form';
import {Panel} from 'sentry/components/panels/panel';
import {PanelBody} from 'sentry/components/panels/panelBody';
import {PanelHeader} from 'sentry/components/panels/panelHeader';
import {t} from 'sentry/locale';
import {ProjectsStore} from 'sentry/stores/projectsStore';
import type {Organization} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';

const SECTION_TITLE = t('Source Server (srcsrv)');

type Props = {
  organization: Organization;
  project: Project;
};

export function EnableNativeSourceServerMapping({organization, project}: Props) {
  return (
    <Form
      saveOnBlur
      apiMethod="PUT"
      apiEndpoint={`/projects/${organization.slug}/${project.slug}/`}
      initialData={{
        enableNativeSourceServerMapping: project.enableNativeSourceServerMapping ?? false,
      }}
      onSubmitSuccess={response => {
        if (response) {
          ProjectsStore.onUpdateSuccess(response as Project);
        }
      }}
    >
      <Panel>
        <PanelHeader>{SECTION_TITLE}</PanelHeader>
        <PanelBody>
          <Access access={['project:write']} project={project}>
            {({hasAccess}) => (
              <BooleanField
                name="enableNativeSourceServerMapping"
                label={t('Enable native source server mapping')}
                help={t(
                  'When enabled, native symbolication rewrites each frame using the source server (srcsrv) mapping embedded in debug files and reports the per-frame VCS revision. Required for source linking from Perforce and other srcsrv-backed source control systems.'
                )}
                disabled={!hasAccess}
                disabledReason={t('You do not have permission to edit this setting.')}
              />
            )}
          </Access>
        </PanelBody>
      </Panel>
    </Form>
  );
}
