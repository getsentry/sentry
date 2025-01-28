import ExternalLink from 'sentry/components/links/externalLink';
import LoadingError from 'sentry/components/loadingError';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import Panel from 'sentry/components/panels/panel';
import PanelBody from 'sentry/components/panels/panelBody';
import PanelHeader from 'sentry/components/panels/panelHeader';
import PreviewFeature from 'sentry/components/previewFeature';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {t, tct} from 'sentry/locale';
import type {ProjectKey} from 'sentry/types/project';
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
    "    response['Public-Key-Pins'] = \\\n" +
    '        \'pin-sha256="cUPcTAZWKaASuYWhhneDttWpY3oBAkE3h2+soZS7sWs="; \' \\\n' +
    '        \'pin-sha256="M8HztCzM3elUxkcjR2S5P4hhyBNf6lHkmjAHKhpGPWE="; \' \\\n' +
    "        'max-age=5184000; includeSubDomains; ' \\\n" +
    `        \'report-uri="${getSecurityDsn(keyList)}"\' \n` +
    '    return response\n'
  );
}

function getReportOnlyInstructions(keyList: ProjectKey[]) {
  return (
    'def middleware(request, response):\n' +
    "    response['Public-Key-Pins-Report-Only'] = \\\n" +
    '        \'pin-sha256="cUPcTAZWKaASuYWhhneDttWpY3oBAkE3h2+soZS7sWs="; \' \\\n' +
    '        \'pin-sha256="M8HztCzM3elUxkcjR2S5P4hhyBNf6lHkmjAHKhpGPWE="; \' \\\n' +
    "        'max-age=5184000; includeSubDomains; ' \\\n" +
    `        \'report-uri="${getSecurityDsn(keyList)}"\' \n` +
    '    return response\n'
  );
}

function ProjectHpkpReports() {
  const organization = useOrganization();
  const {projectId} = useParams();

  const {
    data: keyList,
    isPending,
    isError,
    refetch,
  } = useApiQuery<ProjectKey[]>([`/projects/${organization.slug}/${projectId}/keys/`], {
    staleTime: 0,
  });

  if (isPending) {
    return <LoadingIndicator />;
  }

  if (isError) {
    return <LoadingError onRetry={refetch} />;
  }

  return (
    <div>
      <SentryDocumentTitle
        title={routeTitleGen(t('HTTP Public Key Pinning (HPKP)'), projectId!, false)}
      />
      <SettingsPageHeader title={t('HTTP Public Key Pinning')} />

      <PreviewFeature />

      <ReportUri keyList={keyList} orgId={organization.slug} projectId={projectId!} />

      <Panel>
        <PanelHeader>{t('About')}</PanelHeader>

        <PanelBody withPadding>
          <p>
            {tct(
              `[link:HTTP Public Key Pinning]
              (HPKP) is a security feature that tells a web client to associate a specific
              cryptographic public key with a certain web server to decrease the risk of MITM
              attacks with forged certificates. It's enforced by browser vendors, and Sentry
              supports capturing violations using the standard reporting hooks.`,
              {
                link: (
                  <ExternalLink href="https://en.wikipedia.org/wiki/HTTP_Public_Key_Pinning" />
                ),
              }
            )}
          </p>

          <p>
            {t(
              `To configure HPKP reports
              in Sentry, you'll need to send a header from your server describing your
              policy, as well specifying the authenticated Sentry endpoint.`
            )}
          </p>

          <p>
            {t(
              'For example, in Python you might achieve this via a simple web middleware'
            )}
          </p>
          <pre>{getInstructions(keyList)}</pre>

          <p>
            {t(`Alternatively you can setup HPKP reports to simply send reports rather than
              actually enforcing the policy`)}
          </p>
          <pre>{getReportOnlyInstructions(keyList)}</pre>

          <p>
            {tct(
              `We recommend setting this up to only run on a percentage of requests, as
              otherwise you may find that you've quickly exhausted your quota. For more
              information, take a look at [link:the documentation on MDN].`,
              {
                link: (
                  <ExternalLink href="https://developer.mozilla.org/en-US/docs/Web/HTTP/Public_Key_Pinning" />
                ),
              }
            )}
          </p>
        </PanelBody>
      </Panel>
    </div>
  );
}

export default ProjectHpkpReports;
