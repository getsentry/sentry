import {browserHistory} from 'react-router';
import styled from '@emotion/styled';
import {RouteComponentProps} from 'react-router/lib/Router';

import {t, tct} from 'app/locale';
import AsyncComponent from 'app/components/asyncComponent';
import AutoSelectText from 'app/components/autoSelectText';
import SentryDocumentTitle from 'app/components/sentryDocumentTitle';
import Button from 'app/components/button';
import ExternalLink from 'app/components/links/externalLink';
import PlatformPicker from 'app/components/platformPicker';
import SettingsPageHeader from 'app/views/settings/components/settingsPageHeader';
import TextBlock from 'app/views/settings/components/text/textBlock';
import recreateRoute from 'app/utils/recreateRoute';
import space from 'app/styles/space';
import withOrganization from 'app/utils/withOrganization';
import {Organization, PlatformType} from 'app/types';
import {ProjectKey} from 'app/views/settings/project/projectKeys/types';

type Props = RouteComponentProps<{orgId: string; projectId: string}, {}> & {
  organization: Organization;
} & AsyncComponent['props'];

type State = {
  keyList: Array<ProjectKey> | null;
} & AsyncComponent['state'];

class ProjectInstallOverview extends AsyncComponent<Props, State> {
  get isGettingStarted() {
    return window.location.href.indexOf('getting-started') > 0;
  }

  getEndpoints(): ReturnType<AsyncComponent['getEndpoints']> {
    const {orgId, projectId} = this.props.params;
    return [['keyList', `/projects/${orgId}/${projectId}/keys/`]];
  }

  redirectToDocs = (platform: PlatformType) => {
    const {orgId, projectId} = this.props.params;

    const installUrl = this.isGettingStarted
      ? `/organizations/${orgId}/projects/${projectId}/getting-started/${platform}/`
      : recreateRoute(`install/${platform}/`, {
          ...this.props,
          stepBack: -3,
        });

    browserHistory.push(installUrl);
  };

  toggleDsn = () => {
    this.setState(state => ({showDsn: !state.showDsn}));
  };

  render() {
    const {orgId, projectId} = this.props.params;
    const {keyList, showDsn} = this.state;

    const issueStreamLink = `/organizations/${orgId}/issues/#welcome`;

    return (
      <div>
        <SentryDocumentTitle title={t('Instrumentation')} objSlug={projectId} />
        <SettingsPageHeader title={t('Configure your application')} />
        <TextBlock>
          {t(
            'Get started by selecting the platform or language that powers your application.'
          )}
        </TextBlock>

        {showDsn ? (
          <DsnInfo>
            <DsnContainer>
              <strong>{t('DSN')}</strong>
              <DsnValue>{keyList?.[0].dsn.public}</DsnValue>
            </DsnContainer>

            <Button priority="primary" to={issueStreamLink}>
              {t('Got it! Take me to the Issue Stream.')}
            </Button>
          </DsnInfo>
        ) : (
          <p>
            <small>
              {tct('Already have things setup? [link:Get your DSN]', {
                link: <Button priority="link" onClick={this.toggleDsn} />,
              })}
              .
            </small>
          </p>
        )}
        <PlatformPicker setPlatform={this.redirectToDocs} showOther={false} />
        <p>
          {tct(
            `For a complete list of client integrations, please see
             [docLink:our in-depth documentation].`,
            {docLink: <ExternalLink href="https://docs.sentry.io" />}
          )}
        </p>
      </div>
    );
  }
}

const DsnValue = styled(p => (
  <code {...p}>
    <AutoSelectText>{p.children}</AutoSelectText>
  </code>
))`
  overflow: hidden;
`;

const DsnInfo = styled('div')`
  margin-bottom: ${space(3)};
`;

const DsnContainer = styled('div')`
  display: grid;
  grid-template-columns: max-content 1fr;
  grid-gap: ${space(1.5)} ${space(2)};
  align-items: center;
  margin-bottom: ${space(2)};
`;

export default withOrganization(ProjectInstallOverview);
