import Access from 'sentry/components/acl/access';
import Feature from 'sentry/components/acl/feature';
import {CopyToClipboardButton} from 'sentry/components/copyToClipboardButton';
import {Alert} from 'sentry/components/core/alert';
import {LinkButton} from 'sentry/components/core/button/linkButton';
import {Text} from 'sentry/components/core/text';
import Form from 'sentry/components/forms/form';
import JsonForm from 'sentry/components/forms/jsonForm';
import type {JsonFormObject} from 'sentry/components/forms/types';
import {NoAccess} from 'sentry/components/noAccess';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {t, tct} from 'sentry/locale';
import {decodeScalar} from 'sentry/utils/queryString';
import useLocationQuery from 'sentry/utils/url/useLocationQuery';
import useOrganization from 'sentry/utils/useOrganization';
import SettingsPageHeader from 'sentry/views/settings/components/settingsPageHeader';
import TextBlock from 'sentry/views/settings/components/text/textBlock';
import {ProjectPermissionAlert} from 'sentry/views/settings/project/projectPermissionAlert';
import {useProjectSettingsOutlet} from 'sentry/views/settings/project/projectSettingsLayout';

export default function ProjectToolbarSettings() {
  const organization = useOrganization();
  const {project} = useProjectSettingsOutlet();
  const {domain} = useLocationQuery({
    fields: {domain: decodeScalar},
  });

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
              <Text bold size="sm" variant="danger">
                {t('Only add trusted domains, that you control, to this list.')}
              </Text>
              <br />
              {t('Domains where the dev toolbar is allowed to access your data.')}
              <br />
              {t(
                'Protocol and port are optional; wildcard subdomains (*) are supported.'
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
          <LinkButton href="https://docs.sentry.io/product/sentry-toolbar/" external>
            {t('Read the Docs')}
          </LinkButton>
        }
      />
      <Feature
        features="sentry-toolbar-ui"
        organization={organization}
        renderDisabled={NoAccess}
      >
        <TextBlock>
          {t(
            `Bring critical Sentry insights and tools directly into your web app for easier troubleshooting with the Dev Toolbar.`
          )}
        </TextBlock>
        <ProjectPermissionAlert project={project} />
        {domain && (
          <Alert.Container>
            <Alert variant="info">
              {tct(
                'To enable the Dev Toolbar, copy and paste your domain into the Allowed Origins text box below: [domain] ',
                {domain: <strong>{domain}</strong>}
              )}
              <CopyToClipboardButton
                borderless
                size="zero"
                text={domain}
                aria-label={t('Copy domain to clipboard')}
              />
            </Alert>
          </Alert.Container>
        )}

        <Form
          apiMethod="PUT"
          apiEndpoint={`/projects/${organization.slug}/${project.slug}/`}
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
