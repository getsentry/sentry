import React from 'react';

import {Panel, PanelBody, PanelHeader} from 'app/components/panels';
import {t, tct} from 'app/locale';
import Access from 'app/components/acl/access';
import AsyncView from 'app/views/asyncView';
import ExternalLink from 'app/components/links/externalLink';
import Form from 'app/views/settings/components/forms/form';
import JsonForm from 'app/views/settings/components/forms/jsonForm';
import PreviewFeature from 'app/components/previewFeature';
import ReportUri, {
  getSecurityDsn,
} from 'app/views/settings/projectSecurityHeaders/reportUri';
import SettingsPageHeader from 'app/views/settings/components/settingsPageHeader';
import formGroups from 'app/data/forms/cspReports';
import routeTitleGen from 'app/utils/routeTitle';

export default class ProjectCspReports extends AsyncView {
  getEndpoints() {
    const {orgId, projectId} = this.props.params;
    return [
      ['keyList', `/projects/${orgId}/${projectId}/keys/`],
      ['project', `/projects/${orgId}/${projectId}/`],
    ];
  }

  getTitle() {
    const {projectId} = this.props.params;
    return routeTitleGen(t('Content Security Policy (CSP)'), projectId, false);
  }

  getInstructions() {
    return (
      'def middleware(request, response):\n' +
      "    response['Content-Security-Policy'] = \\\n" +
      '        "default-src *; " \\\n' +
      "        \"script-src 'self' 'unsafe-eval' 'unsafe-inline' cdn.example.com cdn.ravenjs.com; \" \\\n" +
      "        \"style-src 'self' 'unsafe-inline' cdn.example.com; \" \\\n" +
      '        "img-src * data:; " \\\n' +
      '        "report-uri ' +
      getSecurityDsn(this.state.keyList) +
      '"\n' +
      '    return response\n'
    );
  }

  getReportOnlyInstructions() {
    return (
      'def middleware(request, response):\n' +
      "    response['Content-Security-Policy-Report-Only'] = \\\n" +
      '        "default-src \'self\'; " \\\n' +
      '        "report-uri ' +
      getSecurityDsn(this.state.keyList) +
      '"\n' +
      '    return response\n'
    );
  }

  renderBody() {
    const {orgId, projectId} = this.props.params;

    return (
      <div>
        <SettingsPageHeader title={t('Content Security Policy')} />

        <PreviewFeature />

        <ReportUri keyList={this.state.keyList} params={this.props.params} />

        <Form
          saveOnBlur
          apiMethod="PUT"
          initialData={this.state.project.options}
          apiEndpoint={`/projects/${orgId}/${projectId}/`}
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
                  csp: <acronym title="Content Security Policy" />,
                }
              )}
            </p>

            <p>
              {t(
                'For example, in Python you might achieve this via a simple web middleware'
              )}
            </p>
            <pre>{this.getInstructions()}</pre>

            <p>
              {t(`Alternatively you can setup CSP reports to simply send reports rather than
              actually enforcing the policy`)}
            </p>
            <pre>{this.getReportOnlyInstructions()}</pre>

            <p>
              {tct(
                `We recommend setting this up to only run on a percentage of requests, as
              otherwise you may find that you've quickly exhausted your quota. For more
              information, take a look at [link:the article on html5rocks.com].`,
                {
                  link: (
                    <a href="http://www.html5rocks.com/en/tutorials/security/content-security-policy/" />
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
