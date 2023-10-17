import Access from 'sentry/components/acl/access';
import Form from 'sentry/components/forms/form';
import JsonForm from 'sentry/components/forms/jsonForm';
import ExternalLink from 'sentry/components/links/externalLink';
import LoadingError from 'sentry/components/loadingError';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import Panel from 'sentry/components/panels/panel';
import PanelBody from 'sentry/components/panels/panelBody';
import PanelHeader from 'sentry/components/panels/panelHeader';
import PreviewFeature from 'sentry/components/previewFeature';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import formGroups from 'sentry/data/forms/cspReports';
import {t, tct} from 'sentry/locale';
import {Project, ProjectKey} from 'sentry/types';
import {useApiQuery} from 'sentry/utils/queryClient';
import routeTitleGen from 'sentry/utils/routeTitle';
import useOrganization from 'sentry/utils/useOrganization';
import {useParams} from 'sentry/utils/useParams';
import SettingsPageHeader from 'sentry/views/settings/components/settingsPageHeader';
import ReportUri, {
  getSecurityDsn,
} from 'sentry/views/settings/projectSecurityHeaders/reportUri';

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
  const params = useParams();
  const projectId = params.projectId;

  const {
    data: keyList,
    isLoading: isLoadingKeyList,
    isError: isKeyListError,
    refetch: refetchKeyList,
  } = useApiQuery<ProjectKey[]>([`/projects/${organization.slug}/${projectId}/keys/`], {
    staleTime: 0,
  });
  const {
    data: project,
    isLoading: isLoadingProject,
    isError: isProjectError,
    refetch: refetchProject,
  } = useApiQuery<Project>([`/projects/${organization.slug}/${projectId}/`], {
    staleTime: 0,
  });

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

  return (
    <div>
      <SentryDocumentTitle
        title={routeTitleGen(t('Content Security Policy (CSP)'), projectId, false)}
      />
      <SettingsPageHeader title={t('Content Security Policy')} />

      <PreviewFeature />

      <ReportUri keyList={keyList} orgId={organization.slug} projectId={projectId} />

      <Form
        saveOnBlur
        apiMethod="PUT"
        initialData={project.options}
        apiEndpoint={`/projects/${organization.slug}/${projectId}/`}
      >
        <Access access={['project:write']}>
          {({hasAccess}) => <JsonForm disabled={!hasAccess} forms={formGroups} />}
        </Access>
      </Form>

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
    </div>
  );
}
