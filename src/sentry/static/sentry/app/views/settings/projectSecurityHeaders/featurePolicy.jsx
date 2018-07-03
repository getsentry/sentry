import PropTypes from 'prop-types';
import React from 'react';

import {t, tct} from 'app/locale';
import AsyncView from 'app/views/asyncView';
import ExternalLink from 'app/components/externalLink';
import {Panel, PanelBody, PanelHeader} from 'app/components/panels';
import PreviewFeature from 'app/components/previewFeature';
import ReportUri, {
  getSecurityDsn,
} from 'app/views/settings/projectSecurityHeaders/reportUri';
import SettingsPageHeader from 'app/views/settings/components/settingsPageHeader';

export default class ProjectFeaturePolicyReports extends AsyncView {
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
    return `Report-To: {"url": "${getSecurityDsn(
      this.state.keyList
    )}", "max-age": 86400}`;
  }

  renderBody() {
    return (
      <div>
        <SettingsPageHeader title={t('Feature Policy')} />

        <PreviewFeature />

        <ReportUri keyList={this.state.keyList} params={this.props.params} />

        <Panel>
          <PanelHeader>{'About'}</PanelHeader>
          <PanelBody disablePadding={false}>
            <p>
              {tct(
                `[link:Feature Policy]
      is a security standard which gives a website the ability to allow and deny the use of browser features in its own frame, and in iframes that it embeds`,
                {
                  link: <ExternalLink href="https://github.com/WICG/feature-policy" />,
                }
              )}
            </p>
            <p>
              {tct(
                "To configure reports in Sentry, you'll need to configure the [header] a header from your server:",
                {
                  header: <code>Report-To</code>,
                }
              )}
            </p>

            <pre>{this.getInstructions()}</pre>

            <p>
              {tct('For more information, see [link:the documentation on GitHub].', {
                link: (
                  <a href="https://github.com/WICG/feature-policy/blob/master/reporting.md" />
                ),
              })}
            </p>
          </PanelBody>
        </Panel>
      </div>
    );
  }
}
