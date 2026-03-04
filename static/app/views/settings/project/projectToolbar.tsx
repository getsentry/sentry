import {z} from 'zod';

import {Alert} from '@sentry/scraps/alert';
import {LinkButton} from '@sentry/scraps/button';
import {AutoSaveField, FieldGroup, FormSearch} from '@sentry/scraps/form';
import {Text} from '@sentry/scraps/text';

import {addSuccessMessage} from 'sentry/actionCreators/indicator';
import {hasEveryAccess} from 'sentry/components/acl/access';
import {CopyToClipboardButton} from 'sentry/components/copyToClipboardButton';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {t, tct} from 'sentry/locale';
import {fetchMutation} from 'sentry/utils/queryClient';
import {decodeScalar} from 'sentry/utils/queryString';
import useLocationQuery from 'sentry/utils/url/useLocationQuery';
import useOrganization from 'sentry/utils/useOrganization';
import SettingsPageHeader from 'sentry/views/settings/components/settingsPageHeader';
import TextBlock from 'sentry/views/settings/components/text/textBlock';
import {ProjectPermissionAlert} from 'sentry/views/settings/project/projectPermissionAlert';
import {useProjectSettingsOutlet} from 'sentry/views/settings/project/projectSettingsLayout';

const toolbarSchema = z.object({
  'sentry:toolbar_allowed_origins': z.string(),
});

export default function ProjectToolbarSettings() {
  const organization = useOrganization();
  const {project} = useProjectSettingsOutlet();
  const hasAccess = hasEveryAccess(['project:write'], {organization, project});
  const {domain} = useLocationQuery({
    fields: {domain: decodeScalar},
  });

  const initialValue =
    (project.options?.['sentry:toolbar_allowed_origins'] as string | undefined) ?? '';

  return (
    <FormSearch route="/settings/:orgId/projects/:projectId/toolbar/">
      <SentryDocumentTitle title={t('Toolbar Settings')} projectSlug={project.slug}>
        <SettingsPageHeader
          title={t('Dev Toolbar')}
          action={
            <LinkButton href="https://docs.sentry.io/product/sentry-toolbar/" external>
              {t('Read the Docs')}
            </LinkButton>
          }
        />
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
                priority="transparent"
                size="zero"
                text={domain}
                aria-label={t('Copy domain to clipboard')}
              />
            </Alert>
          </Alert.Container>
        )}

        <FieldGroup title={t('Settings')}>
          <AutoSaveField
            name="sentry:toolbar_allowed_origins"
            schema={toolbarSchema}
            initialValue={initialValue}
            mutationOptions={{
              mutationFn: data =>
                fetchMutation({
                  url: `/projects/${organization.slug}/${project.slug}/`,
                  method: 'PUT',
                  data: {options: data},
                }),
              onSuccess: () => {
                addSuccessMessage(t('Saved'));
              },
            }}
          >
            {field => (
              <field.Layout.Stack
                label={t('Allowed Origins')}
                hintText={
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
                }
              >
                <field.TextArea
                  value={field.state.value}
                  onChange={field.handleChange}
                  disabled={!hasAccess}
                  autosize
                  rows={3}
                />
              </field.Layout.Stack>
            )}
          </AutoSaveField>
        </FieldGroup>
      </SentryDocumentTitle>
    </FormSearch>
  );
}
