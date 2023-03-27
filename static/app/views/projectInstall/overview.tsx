import {browserHistory, RouteComponentProps} from 'react-router';
import styled from '@emotion/styled';

import AsyncComponent from 'sentry/components/asyncComponent';
import AutoSelectText from 'sentry/components/autoSelectText';
import {Button} from 'sentry/components/button';
import ExternalLink from 'sentry/components/links/externalLink';
import PlatformPicker from 'sentry/components/platformPicker';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {PlatformKey} from 'sentry/data/platformCategories';
import {t, tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {Organization} from 'sentry/types';
import recreateRoute from 'sentry/utils/recreateRoute';
import {normalizeUrl} from 'sentry/utils/withDomainRequired';
import withOrganization from 'sentry/utils/withOrganization';
import SettingsPageHeader from 'sentry/views/settings/components/settingsPageHeader';
import TextBlock from 'sentry/views/settings/components/text/textBlock';
import {ProjectKey} from 'sentry/views/settings/project/projectKeys/types';

type Props = RouteComponentProps<{projectId: string}, {}> & {
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
    const {organization} = this.props;
    const {projectId} = this.props.params;
    return [['keyList', `/projects/${organization.slug}/${projectId}/keys/`]];
  }

  redirectToDocs = (platform: PlatformKey | null) => {
    const {organization} = this.props;
    const {projectId} = this.props.params;

    const installUrl = this.isGettingStarted
      ? `/organizations/${organization.slug}/projects/${projectId}/getting-started/${platform}/`
      : recreateRoute(`${platform}/`, {
          ...this.props,
          stepBack: -1,
        });

    browserHistory.push(normalizeUrl(installUrl));
  };

  toggleDsn = () => {
    this.setState(state => ({showDsn: !state.showDsn}));
  };

  render() {
    const {organization} = this.props;
    const {projectId} = this.props.params;
    const {keyList, showDsn} = this.state;

    const issueStreamLink = `/organizations/${organization.slug}/issues/#welcome`;

    return (
      <div>
        <SentryDocumentTitle title={t('Instrumentation')} projectSlug={projectId} />
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
                link: (
                  <Button
                    priority="link"
                    onClick={this.toggleDsn}
                    aria-label={t('Get your DSN')}
                  />
                ),
              })}
              .
            </small>
          </p>
        )}
        <PlatformPicker
          setPlatform={this.redirectToDocs}
          showOther={false}
          organization={this.props.organization}
        />
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
  gap: ${space(1.5)} ${space(2)};
  align-items: center;
  margin-bottom: ${space(2)};
`;

export default withOrganization(ProjectInstallOverview);
