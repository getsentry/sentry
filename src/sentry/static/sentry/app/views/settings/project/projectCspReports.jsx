import PropTypes from 'prop-types';
import React from 'react';
import styled from 'react-emotion';

import {t, tct} from '../../../locale';
import AsyncView from '../../asyncView';
import ExternalLink from '../../../components/externalLink';
import Form from '../components/forms/form';
import JsonForm from '../components/forms/jsonForm';
import Panel from '../components/panel';
import PanelBody from '../components/panelBody';
import PanelHeader from '../components/panelHeader';
import SettingsPageHeader from '../components/settingsPageHeader';
import TextBlock from '../components/text/textBlock';
import formGroups from '../../../data/forms/cspReports';

const CodeBlock = styled.pre`
  word-break: break-all;
  white-space: pre-wrap;
`;
const TextBlockNoMargin = styled(TextBlock)`
  margin-bottom: 0;
`;

class ProjectCspReports extends AsyncView {
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
    let endpoint = this.state.keyList.length
      ? this.state.keyList[0].dsn.csp
      : 'https://sentry.example.com/api/csp-report/';

    return (
      'def middleware(request, response):\n' +
      "    response['Content-Security-Policy'] = \\\n" +
      '        "default-src *; " \\\n' +
      "        \"script-src 'self' 'unsafe-eval' 'unsafe-inline' cdn.example.com cdn.ravenjs.com; \" \\\n" +
      "        \"style-src 'self' 'unsafe-inline' cdn.example.com; \" \\\n" +
      '        "img-src * data:; " \\\n' +
      '        "report-uri ' +
      endpoint +
      '"\n' +
      '    return response\n'
    );
  }

  getReportOnlyInstructions() {
    let endpoint = this.state.keyList.length
      ? this.state.keyList[0].dsn.csp
      : 'https://sentry.example.com/api/csp-report/';

    return (
      'def middleware(request, response):\n' +
      "    response['Content-Security-Policy-Report-Only'] = \\\n" +
      '        "default-src \'self\'; " \\\n' +
      '        "report-uri ' +
      endpoint +
      '"\n' +
      '    return response\n'
    );
  }

  renderBody() {
    let {orgId, projectId} = this.props.params;

    return (
      <div>
        <SettingsPageHeader title={t('CSP Reports')} />

        <div className="alert alert-block alert-info">
          {t(`Psst! This feature is still a work-in-progress. Thanks for being an early
          adopter!`)}
        </div>

        <TextBlock>
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
        </TextBlock>

        <Form
          saveOnBlur
          apiMethod="PUT"
          initialData={this.state.project.options}
          apiEndpoint={`/projects/${orgId}/${projectId}/`}
        >
          <JsonForm forms={formGroups} />
        </Form>

        <Panel>
          <PanelHeader>{t('Integration')}</PanelHeader>

          <PanelBody disablePadding={false}>
            <TextBlock>
              {tct(
                `To configure [csp:CSP] reports
              in Sentry, you'll need to send a header from your server describing your
              policy, as well specifying the authenticated Sentry endpoint.`,
                {
                  csp: <acronym title="Content Security Policy" />,
                }
              )}
            </TextBlock>

            <TextBlockNoMargin>
              {t(
                'For example, in Python you might achieve this via a simple web middleware'
              )}
            </TextBlockNoMargin>
            <CodeBlock>{this.getInstructions()}</CodeBlock>

            <TextBlockNoMargin>
              {t(`Alternatively you can setup CSP reports to simply send reports rather than
              actually enforcing the policy`)}
            </TextBlockNoMargin>
            <CodeBlock>{this.getReportOnlyInstructions()}</CodeBlock>

            <TextBlockNoMargin css={{marginTop: 30}}>
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
            </TextBlockNoMargin>
          </PanelBody>
        </Panel>
      </div>
    );
  }
}

export default ProjectCspReports;
