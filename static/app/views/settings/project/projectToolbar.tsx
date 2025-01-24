import styled from '@emotion/styled';

import Access from 'sentry/components/acl/access';
import Feature from 'sentry/components/acl/feature';
import Alert from 'sentry/components/alert';
import {LinkButton} from 'sentry/components/button';
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
import TextBlock from 'sentry/views/settings/components/text/textBlock';
import PermissionAlert from 'sentry/views/settings/project/permissionAlert';

type RouteParams = {
  projectId: string;
};
type Props = RouteComponentProps<RouteParams, {}> & {
  organization: Organization;
  project: Project;
};

export default function ProjectToolbarSettings({
  organization,
  project,
  params: {projectId},
}: Props) {
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
          help: (
            <div>
              <Important>
                {t('Only add trusted domains, that you control, to this list.')}
              </Important>
              <br />
              {t('Domains where the dev toolbar is allowed to access your data.')}
              <br />
              {t(
                'Protocol and port are optional; wildcard subdomains (*) are are supported.'
              )}
              <br />
              {tct(
                'Example: [code:localhost] is equivalent to [code:http://localhost] or [code:localhost:80]',
                {code: <code />}
              )}
            </div>
          ),
          getData: data => ({options: data}),
        },
      ],
    },
  ];

  return (
    <SentryDocumentTitle title={t('Toolbar Settings')} projectSlug={project.slug}>
      <SettingsPageHeader
        title={t('Dev Toolbar')}
        action={
          <LinkButton href="https://docs.sentry.io/product/dev-toolbar/" external>
            {t('Read the Docs')}
          </LinkButton>
        }
      />
      <Feature
        features="dev-toolbar-ui"
        organization={organization}
        renderDisabled={NoAccess}
      >
        <TextBlock>
          {t(
            `Bring critical Sentry insights and tools directly into your web app for easier troubleshooting with the Dev Toolbar.`
          )}
        </TextBlock>
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

const Important = styled('strong')`
  color: ${p => p.theme.red400};
`;
