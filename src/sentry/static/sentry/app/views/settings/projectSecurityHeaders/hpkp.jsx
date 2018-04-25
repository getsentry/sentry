import React from 'react';
import PropTypes from 'prop-types';
import styled from 'react-emotion';

import {t, tct} from '../../../locale';
import AsyncView from '../../asyncView';
import ExternalLink from '../../../components/externalLink';
import {Panel, PanelBody, PanelHeader} from '../../../components/panels';
import ReportUri, {getSecurityDsn} from './reportUri';
import PreviewFeature from '../../../components/previewFeature';
import SettingsPageHeader from '../components/settingsPageHeader';
import TextBlock from '../components/text/textBlock';

const CodeBlock = styled.pre`
  word-break: break-all;
  white-space: pre-wrap;
`;

export default class ProjectHpkpReports extends AsyncView {
  static propTypes = {
    setProjectNavSection: PropTypes.func,
  };

  componentWillMount() {
    super.componentWillMount();
    this.props.setProjectNavSection('settings');
  }

  getEndpoints() {
    let {orgId, projectId} = this.props.params;
    return [
      ['keyList', `/projects/${orgId}/${projectId}/keys/`],
      ['project', `/projects/${orgId}/${projectId}/`],
    ];
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

          <PanelBody disablePadding={false}>
            <TextBlock>
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
            </TextBlock>

            <TextBlock>
              {t(
                `To configure HPKP reports
              in Sentry, you'll need to send a header from your server describing your
              policy, as well specifying the authenticated Sentry endpoint.`
              )}
            </TextBlock>

            <TextBlock noMargin>
              {t(
                'For example, in Python you might achieve this via a simple web middleware'
              )}
            </TextBlock>
            <CodeBlock>{this.getInstructions()}</CodeBlock>

            <TextBlock noMargin>
              {t(`Alternatively you can setup HPKP reports to simply send reports rather than
              actually enforcing the policy`)}
            </TextBlock>
            <CodeBlock>{this.getReportOnlyInstructions()}</CodeBlock>

            <TextBlock noMargin css={{marginTop: 30}}>
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
            </TextBlock>
          </PanelBody>
        </Panel>
      </div>
    );
  }
}
