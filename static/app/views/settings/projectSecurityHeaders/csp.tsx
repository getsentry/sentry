import {z} from 'zod';

import {AutoSaveField, FieldGroup, FormSearch} from '@sentry/scraps/form';
import {ExternalLink} from '@sentry/scraps/link';
import {Text} from '@sentry/scraps/text';

import {Access} from 'sentry/components/acl/access';
import {LoadingError} from 'sentry/components/loadingError';
import {LoadingIndicator} from 'sentry/components/loadingIndicator';
import {Panel} from 'sentry/components/panels/panel';
import {PanelBody} from 'sentry/components/panels/panelBody';
import {PanelHeader} from 'sentry/components/panels/panelHeader';
import {SentryDocumentTitle} from 'sentry/components/sentryDocumentTitle';
import {t, tct} from 'sentry/locale';
import type {Project, ProjectKey} from 'sentry/types/project';
import {getApiUrl} from 'sentry/utils/api/getApiUrl';
import {fetchMutation, useApiQuery} from 'sentry/utils/queryClient';
import {routeTitleGen} from 'sentry/utils/routeTitle';
import {useOrganization} from 'sentry/utils/useOrganization';
import {useParams} from 'sentry/utils/useParams';
import {SettingsPageHeader} from 'sentry/views/settings/components/settingsPageHeader';
import {
  getSecurityDsn,
  ReportUri,
} from 'sentry/views/settings/projectSecurityHeaders/reportUri';

const cspSchema = z.object({
  'sentry:csp_ignored_sources_defaults': z.boolean(),
  'sentry:csp_ignored_sources': z.string(),
});

type CspSchema = z.infer<typeof cspSchema>;

function getInstructions(keyList: ProjectKey[]) {
  return (
    'def middleware(request, response):\n' +
    "    response['Content-Security-Policy'] = \\\n" +
    '        "default-src *; " \\\n' +
    "        \"script-src 'self' 'unsafe-eval' 'unsafe-inline' cdn.example.com cdn.ravenjs.com; \" \\\n" +
    "        \"style-src 'self' 'unsafe-inline' cdn.example.com; \" \\\n" +
    '        "img-src * data:; " \\\n' +
    '        "report-uri ' +
    getSecurityDsn(keyList) +
    '"\n' +
    '    return response\n'
  );
}

function getReportOnlyInstructions(keyList: ProjectKey[]) {
  return (
    'def middleware(request, response):\n' +
    "    response['Content-Security-Policy-Report-Only'] = \\\n" +
    '        "default-src \'self\'; " \\\n' +
    '        "report-uri ' +
    getSecurityDsn(keyList) +
    '"\n' +
    '    return response\n'
  );
}

export default function ProjectCspReports() {
  const organization = useOrganization();
  const {projectId} = useParams<{projectId: string}>();

  const {
    data: keyList,
    isPending: isLoadingKeyList,
    isError: isKeyListError,
    refetch: refetchKeyList,
  } = useApiQuery<ProjectKey[]>(
    [
      getApiUrl(`/projects/$organizationIdOrSlug/$projectIdOrSlug/keys/`, {
        path: {organizationIdOrSlug: organization.slug, projectIdOrSlug: projectId},
      }),
    ],
    {
      staleTime: 0,
    }
  );
  const {
    data: project,
    isPending: isLoadingProject,
    isError: isProjectError,
    refetch: refetchProject,
  } = useApiQuery<Project>(
    [
      getApiUrl(`/projects/$organizationIdOrSlug/$projectIdOrSlug/`, {
        path: {organizationIdOrSlug: organization.slug, projectIdOrSlug: projectId},
      }),
    ],
    {
      staleTime: 0,
    }
  );

  if (isLoadingKeyList || isLoadingProject) {
    return <LoadingIndicator />;
  }

  if (isKeyListError || isProjectError) {
    return (
      <LoadingError
        onRetry={() => {
          refetchKeyList();
          refetchProject();
        }}
      />
    );
  }

  const projectEndpoint = `/projects/${organization.slug}/${projectId}/`;

  function getCspMutationOptions() {
    return {
      mutationFn: (data: Partial<CspSchema>) =>
        fetchMutation({
          url: projectEndpoint,
          method: 'PUT',
          data: {options: data},
        }),
    };
  }

  return (
    <FormSearch route="/settings/:orgId/projects/:projectId/security-headers/csp/">
      <SentryDocumentTitle
        title={routeTitleGen(t('Content Security Policy (CSP)'), projectId, false)}
      />
      <SettingsPageHeader title={t('Content Security Policy')} />

      <ReportUri keyList={keyList} orgId={organization.slug} projectId={projectId} />

      <Access access={['project:write']} project={project}>
        {({hasAccess}) => (
          <FieldGroup title={t('CSP Settings')}>
            <AutoSaveField
              name="sentry:csp_ignored_sources_defaults"
              schema={cspSchema}
              initialValue={
                (project.options?.['sentry:csp_ignored_sources_defaults'] as
                  | boolean
                  | undefined) ?? false
              }
              mutationOptions={getCspMutationOptions()}
            >
              {field => (
                <field.Layout.Row
                  label={t('Use default ignored sources')}
                  hintText={t(
                    'Our default list will attempt to ignore common issues and reduce noise.'
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
              name="sentry:csp_ignored_sources"
              schema={cspSchema}
              initialValue={
                (project.options?.['sentry:csp_ignored_sources'] as string | undefined) ??
                ''
              }
              mutationOptions={getCspMutationOptions()}
            >
              {field => (
                <field.Layout.Stack
                  label={t('Additional ignored sources')}
                  hintText={t(
                    'Discard reports about requests from the given sources. Separate multiple entries with a newline.'
                  )}
                >
                  <field.TextArea
                    value={field.state.value}
                    onChange={field.handleChange}
                    autosize
                    rows={4}
                    placeholder={'e.g.\nfile://*\n*.example.com\nexample.com'}
                    disabled={!hasAccess}
                  />
                  <Text size="sm" variant="muted">
                    {t('Separate multiple entries with a newline.')}
                  </Text>
                </field.Layout.Stack>
              )}
            </AutoSaveField>
          </FieldGroup>
        )}
      </Access>

      <Panel>
        <PanelHeader>{t('About')}</PanelHeader>

        <PanelBody withPadding>
          <p>
            {tct(
              `[link:Content Security Policy]
            (CSP) is a security standard which helps prevent cross-site scripting (XSS),
            clickjacking and other code injection attacks resulting from execution of
            malicious content in the trusted web page context. It's enforced by browser
            vendors, and Sentry supports capturing CSP violations using the standard
            reporting hooks.`,
              {
                link: (
                  <ExternalLink href="https://en.wikipedia.org/wiki/Content_Security_Policy" />
                ),
              }
            )}
          </p>

          <p>
            {tct(
              `To configure [csp:CSP] reports
              in Sentry, you'll need to send a header from your server describing your
              policy, as well specifying the authenticated Sentry endpoint.`,
              {
                csp: <abbr title="Content Security Policy" />,
              }
            )}
          </p>

          <p>
            {t(
              'For example, in Python you might achieve this via a simple web middleware'
            )}
          </p>
          <pre>{getInstructions(keyList)}</pre>

          <p>
            {t(`Alternatively you can setup CSP reports to simply send reports rather than
              actually enforcing the policy`)}
          </p>
          <pre>{getReportOnlyInstructions(keyList)}</pre>

          <p>
            {tct(
              `We recommend setting this up to only run on a percentage of requests, as
              otherwise you may find that you've quickly exhausted your quota. For more
              information, take a look at [link:the article on html5rocks.com].`,
              {
                link: (
                  <ExternalLink href="http://www.html5rocks.com/en/tutorials/security/content-security-policy/" />
                ),
              }
            )}
          </p>
        </PanelBody>
      </Panel>
    </FormSearch>
  );
}
