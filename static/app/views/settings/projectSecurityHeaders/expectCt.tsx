import ExternalLink from 'sentry/components/links/externalLink';
import LoadingError from 'sentry/components/loadingError';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import Panel from 'sentry/components/panels/panel';
import PanelBody from 'sentry/components/panels/panelBody';
import PanelHeader from 'sentry/components/panels/panelHeader';
import PreviewFeature from 'sentry/components/previewFeature';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {t, tct} from 'sentry/locale';
import {ProjectKey} from 'sentry/types';
import {useApiQuery} from 'sentry/utils/queryClient';
import routeTitleGen from 'sentry/utils/routeTitle';
import useOrganization from 'sentry/utils/useOrganization';
import {useParams} from 'sentry/utils/useParams';
import SettingsPageHeader from 'sentry/views/settings/components/settingsPageHeader';
import ReportUri, {
  getSecurityDsn,
} from 'sentry/views/settings/projectSecurityHeaders/reportUri';

function getInstructions(keyList: ProjectKey[]) {
  return `Expect-CT: report-uri="${getSecurityDsn(keyList)}"`;
}

function ProjectExpectCtReports() {
  const organization = useOrganization();
  const {projectId} = useParams();

  const {
    data: keyList,
    isLoading,
    isError,
    refetch,
  } = useApiQuery<ProjectKey[]>([`/projects/${organization.slug}/${projectId}/keys/`], {
    staleTime: 0,
  });

  if (isLoading) {
    return <LoadingIndicator />;
  }

  if (isError) {
    return <LoadingError onRetry={refetch} />;
  }

  return (
    <div>
      <SentryDocumentTitle
        title={routeTitleGen(t('Certificate Transparency (Expect-CT)'), projectId, false)}
      />
      <SettingsPageHeader title={t('Certificate Transparency')} />

      <PreviewFeature />

      <ReportUri keyList={keyList} orgId={organization.slug} projectId={projectId} />

      <Panel>
        <PanelHeader>{t('About')}</PanelHeader>
        <PanelBody withPadding>
          <p>
            {tct(
              `[link:Certificate Transparency]
      (CT) is a security standard which helps track and identify valid certificates, allowing identification of maliciously issued certificates`,
              {
                link: (
                  <ExternalLink href="https://en.wikipedia.org/wiki/Certificate_Transparency" />
                ),
              }
            )}
          </p>
          <p>
            {tct(
              "To configure reports in Sentry, you'll need to configure the [header] a header from your server:",
              {
                header: <code>Expect-CT</code>,
              }
            )}
          </p>

          <pre>{getInstructions(keyList)}</pre>

          <p>
            {tct('For more information, see [link:the article on MDN].', {
              link: (
                <ExternalLink href="https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Expect-CT" />
              ),
            })}
          </p>
        </PanelBody>
      </Panel>
    </div>
  );
}

export default ProjectExpectCtReports;
