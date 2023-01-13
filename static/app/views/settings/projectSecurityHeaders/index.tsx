import {RouteComponentProps} from 'react-router';
import styled from '@emotion/styled';

import {Button} from 'sentry/components/button';
import {KeyValueTable, KeyValueTableRow} from 'sentry/components/keyValueTable';
import {Panel, PanelBody, PanelHeader, PanelItem} from 'sentry/components/panels';
import {t, tct} from 'sentry/locale';
import {Organization, ProjectKey} from 'sentry/types';
import recreateRoute from 'sentry/utils/recreateRoute';
import routeTitleGen from 'sentry/utils/routeTitle';
import withOrganization from 'sentry/utils/withOrganization';
import AsyncView from 'sentry/views/asyncView';
import SettingsPageHeader from 'sentry/views/settings/components/settingsPageHeader';
import TextBlock from 'sentry/views/settings/components/text/textBlock';
import ReportUri from 'sentry/views/settings/projectSecurityHeaders/reportUri';

type Props = {
  organization: Organization;
} & RouteComponentProps<{projectId: string}, {}>;

type State = {
  keyList: null | ProjectKey[];
} & AsyncView['state'];

class ProjectSecurityHeaders extends AsyncView<Props, State> {
  getEndpoints(): ReturnType<AsyncView['getEndpoints']> {
    const {organization} = this.props;
    const {projectId} = this.props.params;

    return [['keyList', `/projects/${organization.slug}/${projectId}/keys/`]];
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
    const {organization, params} = this.props;
    const {keyList} = this.state;
    if (keyList === null) {
      return null;
    }

    return (
      <div>
        <SettingsPageHeader title={t('Security Header Reports')} />

        <ReportUri
          keyList={keyList}
          projectId={params.projectId}
          orgId={organization.slug}
        />

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
            <KeyValueTable>
              <KeyValueTableRow
                keyName="sentry_environment"
                value={t('The environment name (e.g. production).')}
              />
              <KeyValueTableRow
                keyName="sentry_release"
                value={t('The version of the application.')}
              />
            </KeyValueTable>
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

export default withOrganization(ProjectSecurityHeaders);

const ReportItem = styled(PanelItem)`
  align-items: center;
  justify-content: space-between;
`;

const HeaderName = styled('span')`
  font-size: 1.2em;
`;
