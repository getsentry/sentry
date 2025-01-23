import Access from 'sentry/components/acl/access';
import Feature from 'sentry/components/acl/feature';
import Alert from 'sentry/components/alert';
import {CopyToClipboardButton} from 'sentry/components/copyToClipboardButton';
import Form from 'sentry/components/forms/form';
import JsonForm from 'sentry/components/forms/jsonForm';
import type {JsonFormObject} from 'sentry/components/forms/types';
import {NoAccess} from 'sentry/components/noAccess';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {t, tct} from 'sentry/locale';
import type {RouteComponentProps} from 'sentry/types/legacyReactRouter';
import type {Organization} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';
import {decodeScalar} from 'sentry/utils/queryString';
import {useLocation} from 'sentry/utils/useLocation';
import SettingsPageHeader from 'sentry/views/settings/components/settingsPageHeader';
import PermissionAlert from 'sentry/views/settings/project/permissionAlert';

type RouteParams = {
  projectId: string;
};
type Props = RouteComponentProps<RouteParams, {}> & {
  organization: Organization;
  project: Project;
};

function ProjectToolbarSettings({organization, project, params: {projectId}}: Props) {
  const location = useLocation();
  const domain = decodeScalar(location.query.domain);

  const formGroups: JsonFormObject[] = [
    {
      title: 'Settings',
      fields: [
        {
          name: 'sentry:toolbar_allowed_origins',
          type: 'textarea',
          rows: 3,
          autosize: true,
          formatMessageValue: false,

          // additional data/props that is related to rendering of form field rather than data
          label: t('Allowed Origins'),
          help: t(
            'Domain URLs where the dev toolbar can be installed and access your data. Wildcards (*) are supported. Please separate multiple entries with a newline.'
          ),
          getData: data => ({options: data}),
        },
      ],
    },
  ];

  return (
    <SentryDocumentTitle title={t('Toolbar Settings')} projectSlug={project.slug}>
      <SettingsPageHeader title={t('Developer Toolbar')} />
      <Feature
        features="dev-toolbar-ui"
        organization={organization}
        renderDisabled={NoAccess}
      >
        <PermissionAlert project={project} />
        {domain && (
          <Alert type="info" showIcon>
            {tct(
              'To enable the Dev Toolbar, copy and paste your domain into the Allowed Origins text box below: [domain] ',
              {domain: <strong>{domain}</strong>}
            )}
            <CopyToClipboardButton borderless iconSize="xs" size="zero" text={domain} />
          </Alert>
        )}

        <Form
          apiMethod="PUT"
          apiEndpoint={`/projects/${organization.slug}/${projectId}/`}
          initialData={project.options}
          saveOnBlur
        >
          <Access access={['project:write']} project={project}>
            {({hasAccess}) => (
              <JsonForm
                disabled={!hasAccess}
                features={new Set(organization.features)}
                forms={formGroups}
              />
            )}
          </Access>
        </Form>
      </Feature>
    </SentryDocumentTitle>
  );
}

export default ProjectToolbarSettings;
