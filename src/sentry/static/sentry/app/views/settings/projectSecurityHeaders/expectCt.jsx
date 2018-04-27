import PropTypes from 'prop-types';
import React from 'react';
import styled from 'react-emotion';

import {t, tct} from 'app/locale';
import AsyncView from 'app/views/asyncView';
import ExternalLink from 'app/components/externalLink';
import {Panel, PanelBody, PanelHeader} from 'app/components/panels';
import PreviewFeature from 'app/components/previewFeature';
import ReportUri, {
  getSecurityDsn,
} from 'app/views/settings/projectSecurityHeaders/reportUri';
import SettingsPageHeader from 'app/views/settings/components/settingsPageHeader';
import TextBlock from 'app/views/settings/components/text/textBlock';

const CodeBlock = styled.pre`
  word-break: break-all;
  white-space: pre-wrap;
`;

export default class ProjectExpectCtReports extends AsyncView {
  static propTypes = {
    setProjectNavSection: PropTypes.func,
  };

  componentWillMount() {
    super.componentWillMount();
    this.props.setProjectNavSection('settings');
  }

  getEndpoints() {
    let {orgId, projectId} = this.props.params;
    return [['keyList', `/projects/${orgId}/${projectId}/keys/`]];
  }

  getInstructions() {
    return `Expect-CT: report-uri="${getSecurityDsn(this.state.keyList)}"`;
  }

  renderBody() {
    return (
      <div>
        <SettingsPageHeader title={t('Certificate Transparency')} />

        <PreviewFeature />

        <ReportUri keyList={this.state.keyList} params={this.props.params} />

        <Panel>
          <PanelHeader>{'About'}</PanelHeader>
          <PanelBody disablePadding={false}>
            <TextBlock>
              {tct(
                `[link:Certificate Transparency]
      (CT) is a security standard which helps track and identify valid certificates, allowing identification of maliciously issued certificates`,
                {
                  link: (
                    <ExternalLink href="https://en.wikipedia.org/wiki/Certificate_Transparency" />
                  ),
                }
              )}
            </TextBlock>
            <TextBlock>
              {tct(
                "To configure reports in Sentry, you'll need to configure the [header] a header from your server:",
                {
                  header: <code>Expect-CT</code>,
                }
              )}
            </TextBlock>

            <CodeBlock>{this.getInstructions()}</CodeBlock>

            <TextBlock noMargin>
              {tct('For more information, see [link:the article on MDN].', {
                link: (
                  <a href="https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Expect-CT" />
                ),
              })}
            </TextBlock>
          </PanelBody>
        </Panel>
      </div>
    );
  }
}
