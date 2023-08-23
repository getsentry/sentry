import {RouteComponentProps} from 'react-router';

import ExternalLink from 'sentry/components/links/externalLink';
import Panel from 'sentry/components/panels/panel';
import PanelBody from 'sentry/components/panels/panelBody';
import PanelHeader from 'sentry/components/panels/panelHeader';
import PreviewFeature from 'sentry/components/previewFeature';
import {t, tct} from 'sentry/locale';
import {Organization, ProjectKey} from 'sentry/types';
import routeTitleGen from 'sentry/utils/routeTitle';
import withOrganization from 'sentry/utils/withOrganization';
import DeprecatedAsyncView from 'sentry/views/deprecatedAsyncView';
import SettingsPageHeader from 'sentry/views/settings/components/settingsPageHeader';

type Props = RouteComponentProps<{projectId: string}, {}> & {
  organization: Organization;
};

type State = {
  keyList: null | ProjectKey[];
} & DeprecatedAsyncView['state'];

class ProjectNelReports extends DeprecatedAsyncView<Props, State> {
  getEndpoints(): ReturnType<DeprecatedAsyncView['getEndpoints']> {
    const {organization} = this.props;
    const {projectId} = this.props.params;
    return [['keyList', `/projects/${organization.slug}/${projectId}/keys/`]];
  }

  getTitle() {
    const {projectId} = this.props.params;
    return routeTitleGen(t('Network Error Logging (NEL)'), projectId, false);
  }

  getInstructions(keyList: ProjectKey[]) {
    return (
      'NEL: {"report_to":"nel","include_subdomains":true,"max_age":86400,"success_fraction":0.0,"failure_fraction":1.0}\n' +
      'Report-To: {"group":"nel","max_age":86400,"endpoints":[{"url":"' +
      keyList[0].dsn.nel +
      '"}]}'
    );
  }

  renderBody() {
    const {keyList} = this.state;
    if (!keyList) {
      return null;
    }

    return (
      <div>
        <SettingsPageHeader title={t('Network Error Logging')} />

        <PreviewFeature />

        <Panel>
          <PanelHeader>{t('About')}</PanelHeader>
          <PanelBody withPadding>
            <p>
              {tct(
                `[link:Network Error Logging]
      (NEL) is a mechanism that can be configured via the NEL HTTP response header. This experimental header allows websites and applications to opt-in to receive reports about failed (and, if desired, successful) network fetches from supporting browsers.`,
                {
                  link: (
                    <ExternalLink href="https://developer.mozilla.org/en-US/docs/Web/HTTP/Network_Error_Logging" />
                  ),
                }
              )}
            </p>
            <p>
              To configure reports in Sentry, you'll need to configure the headers from
              your server:
            </p>

            <pre>{this.getInstructions(keyList)}</pre>

            <p>
              {tct('For more information, see [link:the article on MDN].', {
                link: (
                  <ExternalLink href="https://developer.mozilla.org/en-US/docs/Web/HTTP/Network_Error_Logging" />
                ),
              })}
            </p>
          </PanelBody>
        </Panel>
      </div>
    );
  }
}

export default withOrganization(ProjectNelReports);
