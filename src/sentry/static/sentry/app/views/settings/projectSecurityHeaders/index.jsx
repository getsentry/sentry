import React from 'react';
import styled from '@emotion/styled';

import {t, tct} from 'app/locale';
import AsyncView from 'app/views/asyncView';
import Button from 'app/components/button';
import {Panel, PanelBody, PanelHeader, PanelItem} from 'app/components/panels';
import recreateRoute from 'app/utils/recreateRoute';
import routeTitleGen from 'app/utils/routeTitle';
import ReportUri from 'app/views/settings/projectSecurityHeaders/reportUri';
import SettingsPageHeader from 'app/views/settings/components/settingsPageHeader';
import TextBlock from 'app/views/settings/components/text/textBlock';

export default class ProjectSecurityHeaders extends AsyncView {
  getEndpoints() {
    const {orgId, projectId} = this.props.params;
    return [['keyList', `/projects/${orgId}/${projectId}/keys/`]];
  }

  getTitle() {
    const {projectId} = this.props.params;
    return routeTitleGen(t('Security Headers'), projectId, false);
  }

  getReports() {
    return [
      {
        name: 'Content Security Policy (CSP)',
        url: recreateRoute('csp/', this.props),
      },
      {
        name: 'Certificate Transparency (Expect-CT)',
        url: recreateRoute('expect-ct/', this.props),
      },
      {
        name: 'HTTP Public Key Pinning (HPKP)',
        url: recreateRoute('hpkp/', this.props),
      },
    ];
  }

  renderBody() {
    return (
      <div>
        <SettingsPageHeader title={t('Security Header Reports')} />

        <ReportUri keyList={this.state.keyList} params={this.props.params} />

        <Panel>
          <PanelHeader>{t('Additional Configuration')}</PanelHeader>
          <PanelBody withPadding>
            <TextBlock style={{marginBottom: 20}}>
              {tct(
                'In addition to the [key_param] parameter, you may also pass the following within the querystring for the report URI:',
                {
                  key_param: <code>sentry_key</code>,
                }
              )}
            </TextBlock>
            <table className="table" style={{marginBottom: 0}}>
              <tbody>
                <tr>
                  <th style={{padding: '8px 5px'}}>sentry_environment</th>
                  <td style={{padding: '8px 5px'}}>
                    {t('The environment name (e.g. production)')}.
                  </td>
                </tr>
                <tr>
                  <th style={{padding: '8px 5px'}}>sentry_release</th>
                  <td style={{padding: '8px 5px'}}>
                    {t('The version of the application.')}
                  </td>
                </tr>
              </tbody>
            </table>
          </PanelBody>
        </Panel>

        <Panel>
          <PanelHeader>{t('Supported Formats')}</PanelHeader>
          <PanelBody>
            {this.getReports().map(({name, url}) => (
              <ReportItem key={url}>
                <HeaderName>{name}</HeaderName>
                <Button to={url} priority="primary">
                  {t('Instructions')}
                </Button>
              </ReportItem>
            ))}
          </PanelBody>
        </Panel>
      </div>
    );
  }
}

const ReportItem = styled(PanelItem)`
  align-items: center;
  justify-content: space-between;
`;

const HeaderName = styled('span')`
  font-size: 1.2em;
`;
