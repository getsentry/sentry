import React from 'react';

import {t, tct} from 'app/locale';
import AsyncView from 'app/views/asyncView';
import ExternalLink from 'app/components/links/externalLink';
import {Panel, PanelBody, PanelHeader} from 'app/components/panels';
import ReportUri, {
  getSecurityDsn,
} from 'app/views/settings/projectSecurityHeaders/reportUri';
import PreviewFeature from 'app/components/previewFeature';
import SettingsPageHeader from 'app/views/settings/components/settingsPageHeader';
import routeTitleGen from 'app/utils/routeTitle';

export default class ProjectHpkpReports extends AsyncView {
  getEndpoints() {
    const {orgId, projectId} = this.props.params;
    return [
      ['keyList', `/projects/${orgId}/${projectId}/keys/`],
      ['project', `/projects/${orgId}/${projectId}/`],
    ];
  }

  getTitle() {
    const {projectId} = this.props.params;
    return routeTitleGen(t('HTTP Public Key Pinning (HPKP)'), projectId, false);
  }

  getInstructions() {
    return (
      'def middleware(request, response):\n' +
      "    response['Public-Key-Pins'] = \\\n" +
      '        \'pin-sha256="cUPcTAZWKaASuYWhhneDttWpY3oBAkE3h2+soZS7sWs="; \' \\\n' +
      '        \'pin-sha256="M8HztCzM3elUxkcjR2S5P4hhyBNf6lHkmjAHKhpGPWE="; \' \\\n' +
      "        'max-age=5184000; includeSubDomains; ' \\\n" +
      `        \'report-uri="${getSecurityDsn(this.state.keyList)}"\' \n` +
      '    return response\n'
    );
  }

  getReportOnlyInstructions() {
    return (
      'def middleware(request, response):\n' +
      "    response['Public-Key-Pins-Report-Only'] = \\\n" +
      '        \'pin-sha256="cUPcTAZWKaASuYWhhneDttWpY3oBAkE3h2+soZS7sWs="; \' \\\n' +
      '        \'pin-sha256="M8HztCzM3elUxkcjR2S5P4hhyBNf6lHkmjAHKhpGPWE="; \' \\\n' +
      "        'max-age=5184000; includeSubDomains; ' \\\n" +
      `        \'report-uri="${getSecurityDsn(this.state.keyList)}"\' \n` +
      '    return response\n'
    );
  }

  renderBody() {
    return (
      <div>
        <SettingsPageHeader title={t('HTTP Public Key Pinning')} />

        <PreviewFeature />

        <ReportUri keyList={this.state.keyList} params={this.props.params} />

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
            <pre>{this.getInstructions()}</pre>

            <p>
              {t(`Alternatively you can setup HPKP reports to simply send reports rather than
              actually enforcing the policy`)}
            </p>
            <pre>{this.getReportOnlyInstructions()}</pre>

            <p>
              {tct(
                `We recommend setting this up to only run on a percentage of requests, as
              otherwise you may find that you've quickly exhausted your quota. For more
              information, take a look at [link:the documentation on MDN].`,
                {
                  link: (
                    <a href="https://developer.mozilla.org/en-US/docs/Web/HTTP/Public_Key_Pinning" />
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
