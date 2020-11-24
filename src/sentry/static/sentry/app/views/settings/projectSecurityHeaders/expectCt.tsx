import React from 'react';
import {RouteComponentProps} from 'react-router';

import ExternalLink from 'app/components/links/externalLink';
import {Panel, PanelBody, PanelHeader} from 'app/components/panels';
import PreviewFeature from 'app/components/previewFeature';
import {t, tct} from 'app/locale';
import {ProjectKey} from 'app/types';
import routeTitleGen from 'app/utils/routeTitle';
import AsyncView from 'app/views/asyncView';
import SettingsPageHeader from 'app/views/settings/components/settingsPageHeader';
import ReportUri, {
  getSecurityDsn,
} from 'app/views/settings/projectSecurityHeaders/reportUri';

type Props = RouteComponentProps<{orgId: string; projectId: string}, {}>;

type State = {
  keyList: null | ProjectKey[];
} & AsyncView['state'];

export default class ProjectExpectCtReports extends AsyncView<Props, State> {
  getEndpoints(): ReturnType<AsyncView['getEndpoints']> {
    const {orgId, projectId} = this.props.params;
    return [['keyList', `/projects/${orgId}/${projectId}/keys/`]];
  }

  getTitle() {
    const {projectId} = this.props.params;
    return routeTitleGen(t('Certificate Transparency (Expect-CT)'), projectId, false);
  }

  getInstructions(keyList: ProjectKey[]) {
    return `Expect-CT: report-uri="${getSecurityDsn(keyList)}"`;
  }

  renderBody() {
    const {params} = this.props;
    const {keyList} = this.state;
    if (!keyList) {
      return null;
    }

    return (
      <div>
        <SettingsPageHeader title={t('Certificate Transparency')} />

        <PreviewFeature />

        <ReportUri keyList={keyList} orgId={params.orgId} projectId={params.orgId} />

        <Panel>
          <PanelHeader>{'About'}</PanelHeader>
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
                  <a href="https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Expect-CT" />
                ),
              })}
            </p>
          </PanelBody>
        </Panel>
      </div>
    );
  }
}
