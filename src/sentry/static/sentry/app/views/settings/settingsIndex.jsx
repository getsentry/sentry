import {Flex, Box} from 'grid-emotion';
import DocumentTitle from 'react-document-title';
import React from 'react';
import styled from 'react-emotion';

import {t} from '../../locale';
import ConfigStore from '../../stores/configStore';
import ExternalLink from '../../components/externalLink';
import InlineSvg from '../../components/inlineSvg';
import Link from '../../components/link';
import LoadingIndicator from '../../components/loadingIndicator';
import Panel from './components/panel';
import PanelBody from './components/panelBody';
import PanelHeader from './components/panelHeader';
import SentryTypes from '../../proptypes';
import SettingsLayout from './settingsLayout';
import TextOverflow from '../../components/textOverflow';
import withLatestContext from '../../utils/withLatestContext';

const LINKS = {
  DOCUMENTATION: 'https://docs.sentry.io/',
  DOCUMENTATION_PLATFORMS: 'https://docs.sentry.io/clients/',
  DOCUMENATATION_QUICKSTART: 'https://docs.sentry.io/quickstart/',
  DOCUMENTATION_CLI: 'https://docs.sentry.io/learn/cli/',
  DOCUMENTATION_API: 'https://docs.sentry.io/hosted/api/',
  API: '/settings/account/api/',
  API_APPLICATIONS: '/settings/account/api/applications/',
  MANAGE: '/manage/',
  FORUM: 'https://forum.sentry.io/',
  GITHUB_ISSUES: 'https://github.com/getsentry/sentry/issues',
  SERVICE_STATUS: 'https://status.sentry.io/',
};

const HomePanelHeader = styled(PanelHeader)`
  background: #fff;
  text-align: center;
  font-size: 18px;
  text-transform: unset;
  padding: 35px 30px;
`;

const HomePanelBody = styled(PanelBody)`
  padding: 30px;

  h3 {
    font-size: 14px;
  }

  ul {
    margin: 0;
    li {
      line-height: 1.6;
      /* Bullet color */
      color: ${p => p.theme.gray1};
    }
  }
`;

const HomeIcon = styled.div`
  background: ${p => p.theme[p.color || 'gray2']};
  color: #fff;
  width: 76px;
  height: 76px;
  border-radius: 76px;
  margin: 0 auto 20px;
  > svg {
    margin-top: 14px;
  }
`;

const HomeLink = styled(Link)`
  color: ${p => p.theme.purple};

  &:hover {
    color: ${p => p.theme.purpleDark};
  }
`;

const ExternalHomeLink = styled(ExternalLink)`
  color: ${p => p.theme.purple};

  &:hover {
    color: ${p => p.theme.purpleDark};
  }
`;

class SettingsIndex extends React.Component {
  static propTypes = {
    organization: SentryTypes.Organization,
  };

  render() {
    let {organization} = this.props;
    let user = ConfigStore.get('user');
    let isOnPremise = ConfigStore.get('isOnPremise');
    let isSuperuser = user.isSuperuser;

    let organizationSettingsUrl =
      (organization && `/settings/${organization.slug}/`) || '';

    let supportLinkProps = isOnPremise
      ? {href: LINKS.FORUM}
      : {to: `${organizationSettingsUrl}support`};
    let supportText = isOnPremise ? t('Community Forums') : t('Contact Support');
    let SupportLinkComponent = isOnPremise ? ExternalHomeLink : HomeLink;

    return (
      <DocumentTitle title={organization ? `${organization.slug} Settings` : 'Settings'}>
        <SettingsLayout {...this.props}>
          <Flex mx={-2} wrap>
            <Box w={1 / 3} px={2}>
              <Panel>
                <HomePanelHeader>
                  <HomeLink to="/settings/account/">
                    <HomeIcon color="blue">
                      <InlineSvg src="icon-user" size="44px" />
                    </HomeIcon>
                    {t('My Account')}
                  </HomeLink>
                </HomePanelHeader>

                <HomePanelBody>
                  <h3>{t('Quick links')}:</h3>
                  <ul>
                    <li>
                      <HomeLink to="/settings/account/security/">
                        {t('Change my password')}
                      </HomeLink>
                    </li>
                    <li>
                      <HomeLink to="/settings/account/notifications/">
                        {t('Notification Preferences')}
                      </HomeLink>
                    </li>
                    <li>
                      <HomeLink to="/settings/account/">{t('Change my avatar')}</HomeLink>
                    </li>
                  </ul>
                </HomePanelBody>
              </Panel>
            </Box>

            <Box w={1 / 3} px={2}>
              {/* if admin */}
              <Panel>
                {!organization && <LoadingIndicator overlay />}
                <HomePanelHeader>
                  <HomeLink to={organizationSettingsUrl}>
                    <HomeIcon color="green">
                      <InlineSvg src="icon-stack" size="44px" />
                    </HomeIcon>
                    <TextOverflow css={{lineHeight: '1.1em'}}>
                      {organization ? organization.slug : t('Organization')}
                    </TextOverflow>
                  </HomeLink>
                </HomePanelHeader>
                <HomePanelBody>
                  <h3>{t('Quick links')}:</h3>
                  <ul>
                    <li>
                      <HomeLink to={`${organizationSettingsUrl}projects/`}>
                        {t('Projects')}
                      </HomeLink>
                    </li>
                    <li>
                      <HomeLink to={`${organizationSettingsUrl}teams/`}>
                        {t('Teams')}
                      </HomeLink>
                    </li>
                    <li>
                      <HomeLink to={`${organizationSettingsUrl}members/`}>
                        {t('Members')}
                      </HomeLink>
                    </li>
                  </ul>
                </HomePanelBody>
              </Panel>
            </Box>

            <Box w={1 / 3} px={2}>
              <Panel>
                <HomePanelHeader>
                  <ExternalHomeLink href={LINKS.DOCUMENTATION}>
                    <HomeIcon color="orange">
                      <InlineSvg src="icon-docs" size="48px" />
                    </HomeIcon>
                  </ExternalHomeLink>
                  <ExternalHomeLink href={LINKS.DOCUMENTATION}>
                    {t('Documentation')}
                  </ExternalHomeLink>
                </HomePanelHeader>

                <HomePanelBody>
                  <h3>{t('Quick links')}:</h3>
                  <ul>
                    <li>
                      <ExternalHomeLink href={LINKS.DOCUMENATATION_QUICKSTART}>
                        {t('Quickstart Guide')}
                      </ExternalHomeLink>
                    </li>
                    <li>
                      <ExternalHomeLink href={LINKS.DOCUMENTATION_PLATFORMS}>
                        {t('Platforms & Frameworks')}
                      </ExternalHomeLink>
                    </li>
                    <li>
                      <ExternalHomeLink href={LINKS.DOCUMENTATION_CLI}>
                        {t('Sentry CLI')}
                      </ExternalHomeLink>
                    </li>
                  </ul>
                </HomePanelBody>
              </Panel>
            </Box>

            <Box w={1 / 3} px={2}>
              <Panel>
                <HomePanelHeader>
                  <SupportLinkComponent {...supportLinkProps}>
                    <HomeIcon color="purple">
                      <InlineSvg src="icon-support" size="48px" />
                    </HomeIcon>
                    {t('Support')}
                  </SupportLinkComponent>
                </HomePanelHeader>

                <HomePanelBody>
                  <h3>{t('Quick links')}:</h3>
                  <ul>
                    <li>
                      <SupportLinkComponent {...supportLinkProps}>
                        {supportText}
                      </SupportLinkComponent>
                    </li>
                    <li>
                      <ExternalHomeLink href={LINKS.GITHUB_ISSUES}>
                        {t('Sentry on GitHub')}
                      </ExternalHomeLink>
                    </li>
                    <li>
                      <ExternalHomeLink href={LINKS.SERVICE_STATUS}>
                        {t('Service Status')}
                      </ExternalHomeLink>
                    </li>
                  </ul>
                </HomePanelBody>
              </Panel>
            </Box>

            <Box w={1 / 3} px={2}>
              <Panel>
                <HomePanelHeader>
                  <HomeLink to={LINKS.API}>
                    <HomeIcon>
                      <InlineSvg src="icon-lock" size="48px" />
                    </HomeIcon>
                    {t('API Keys')}
                  </HomeLink>
                </HomePanelHeader>

                <HomePanelBody>
                  <h3>{t('Quick links')}:</h3>
                  <ul>
                    <li>
                      <HomeLink to={LINKS.API}>{t('Auth Tokens')}</HomeLink>
                    </li>
                    <li>
                      <HomeLink to={LINKS.API_APPLICATIONS}>{t('Applications')}</HomeLink>
                    </li>
                    <li>
                      <ExternalHomeLink href={LINKS.DOCUMENTATION_API}>
                        {t('Documentation')}
                      </ExternalHomeLink>
                    </li>
                  </ul>
                </HomePanelBody>
              </Panel>
            </Box>

            {isSuperuser && (
              <Box w={1 / 3} px={2}>
                <Panel>
                  <HomePanelHeader>
                    <HomeLink href={LINKS.MANAGE}>
                      <HomeIcon color="red">
                        <InlineSvg src="icon-laptop" size="48px" />
                      </HomeIcon>
                      {t('Server Admin')}
                    </HomeLink>
                  </HomePanelHeader>
                  <HomePanelBody>
                    <h3>{t('Quick links')}:</h3>
                    <ul>
                      <li />
                      <li />
                      <li />
                    </ul>
                  </HomePanelBody>
                </Panel>
              </Box>
            )}
          </Flex>
        </SettingsLayout>
      </DocumentTitle>
    );
  }
}
export default withLatestContext(SettingsIndex);
