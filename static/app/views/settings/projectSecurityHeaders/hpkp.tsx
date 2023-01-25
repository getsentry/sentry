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

class ProjectHpkpReports extends AsyncView<Props, State> {
  getEndpoints(): ReturnType<AsyncView['getEndpoints']> {
    const {organization} = this.props;
    const {projectId} = this.props.params;
    return [['keyList', `/projects/${organization.slug}/${projectId}/keys/`]];
  }

  getTitle() {
    const {projectId} = this.props.params;
    return routeTitleGen(t('HTTP Public Key Pinning (HPKP)'), projectId, false);
  }

  getInstructions(keyList: ProjectKey[]) {
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

  getReportOnlyInstructions(keyList: ProjectKey[]) {
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

  renderBody() {
    const {organization, params} = this.props;
    const {keyList} = this.state;
    if (!keyList) {
      return null;
    }

    return (
      <div>
        <SettingsPageHeader title={t('HTTP Public Key Pinning')} />

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
            <pre>{this.getInstructions(keyList)}</pre>

            <p>
              {t(`Alternatively you can setup HPKP reports to simply send reports rather than
              actually enforcing the policy`)}
            </p>
            <pre>{this.getReportOnlyInstructions(keyList)}</pre>

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
}

export default withOrganization(ProjectHpkpReports);
