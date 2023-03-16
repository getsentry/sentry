import {RouteComponentProps} from 'react-router';

import ExternalLink from 'sentry/components/links/externalLink';
import {Panel, PanelBody, PanelHeader} from 'sentry/components/panels';
import PreviewFeature from 'sentry/components/previewFeature';
import {t, tct} from 'sentry/locale';
import {Organization, ProjectKey} from 'sentry/types';
import routeTitleGen from 'sentry/utils/routeTitle';
import withOrganization from 'sentry/utils/withOrganization';
import AsyncView from 'sentry/views/asyncView';
import SettingsPageHeader from 'sentry/views/settings/components/settingsPageHeader';
import ReportUri, {
  getSecurityDsn,
} from 'sentry/views/settings/projectSecurityHeaders/reportUri';

type Props = RouteComponentProps<{projectId: string}, {}> & {
  organization: Organization;
};

type State = {
  keyList: null | ProjectKey[];
} & AsyncView['state'];

class ProjectExpectCtReports extends AsyncView<Props, State> {
  getEndpoints(): ReturnType<AsyncView['getEndpoints']> {
    const {organization} = this.props;
    const {projectId} = this.props.params;
    return [['keyList', `/projects/${organization.slug}/${projectId}/keys/`]];
  }

  getTitle() {
    const {projectId} = this.props.params;
    return routeTitleGen(t('Certificate Transparency (Expect-CT)'), projectId, false);
  }

  getInstructions(keyList: ProjectKey[]) {
    return `Expect-CT: report-uri="${getSecurityDsn(keyList)}"`;
  }

  renderBody() {
    const {organization, params} = this.props;
    const {keyList} = this.state;
    if (!keyList) {
      return null;
    }

    return (
      <div>
        <SettingsPageHeader title={t('Certificate Transparency')} />

        <PreviewFeature />

        <ReportUri
          keyList={keyList}
          orgId={organization.slug}
          projectId={params.projectId}
        />

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

            <pre>{this.getInstructions(keyList)}</pre>

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
}

export default withOrganization(ProjectExpectCtReports);
