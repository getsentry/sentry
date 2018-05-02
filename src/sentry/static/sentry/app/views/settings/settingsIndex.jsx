import {Flex, Box} from 'grid-emotion';
import DocumentTitle from 'react-document-title';
import PropTypes from 'prop-types';
import React from 'react';
import styled, {css} from 'react-emotion';

import {t} from 'app/locale';
import Avatar from 'app/components/avatar';
import ConfigStore from 'app/stores/configStore';
import ExternalLink from 'app/components/externalLink';
import InlineSvg from 'app/components/inlineSvg';
import Link from 'app/components/link';
import LoadingIndicator from 'app/components/loadingIndicator';
import {Panel, PanelBody, PanelHeader} from 'app/components/panels';
import overflowEllipsis from 'app/styles/overflowEllipsis';
import SentryTypes from 'app/proptypes';
import SettingsLayout from 'app/views/settings/components/settingsLayout';
import withLatestContext from 'app/utils/withLatestContext';

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

const HOME_ICON_SIZE = 76;

const flexCenter = css`
  display: flex;
  flex-direction: column;
  align-items: center;
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

    let supportLinkProps = {
      isOnPremise,
      href: LINKS.FORUM,
      to: `${organizationSettingsUrl}support`,
    };
    let supportText = isOnPremise ? t('Community Forums') : t('Contact Support');

    return (
      <DocumentTitle title={organization ? `${organization.slug} Settings` : 'Settings'}>
        <SettingsLayout {...this.props}>
          <Flex mx={-2} wrap>
            <Box w={1 / 3} px={2}>
              <Panel>
                <HomePanelHeader>
                  <HomeLinkIcon to="/settings/account/">
                    <AvatarContainer>
                      <Avatar user={user} size={HOME_ICON_SIZE} />
                    </AvatarContainer>
                    {t('My Account')}
                  </HomeLinkIcon>
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
                  <HomeLinkIcon to={organizationSettingsUrl}>
                    {organization ? (
                      <AvatarContainer>
                        <Avatar organization={organization} size={HOME_ICON_SIZE} />
                      </AvatarContainer>
                    ) : (
                      <HomeIcon color="green">
                        <InlineSvg src="icon-stack" size="44px" />
                      </HomeIcon>
                    )}
                    <OrganizationName css={{lineHeight: '1.1em'}}>
                      {organization ? organization.slug : t('Organization')}
                    </OrganizationName>
                  </HomeLinkIcon>
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
                  <ExternalHomeLink css={flexCenter} href={LINKS.DOCUMENTATION}>
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
                  <SupportLinkComponent css={flexCenter} {...supportLinkProps}>
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
                  <HomeLinkIcon to={LINKS.API}>
                    <HomeIcon>
                      <InlineSvg src="icon-lock" size="48px" />
                    </HomeIcon>
                    {t('API Keys')}
                  </HomeLinkIcon>
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
                    <HomeLinkIcon href={LINKS.MANAGE}>
                      <HomeIcon color="red">
                        <InlineSvg src="icon-laptop" size="48px" />
                      </HomeIcon>
                      {t('Server Admin')}
                    </HomeLinkIcon>
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

export {SettingsIndex};
export default withLatestContext(SettingsIndex);

const HomePanelHeader = styled(PanelHeader)`
  background: #fff;
  flex-direction: column;
  text-align: center;
  justify-content: center;
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

const getHomeIconMargin = css`
  margin-bottom: 20px;
`;

const HomeIcon = styled.div`
  background: ${p => p.theme[p.color || 'gray2']};
  color: #fff;
  width: ${HOME_ICON_SIZE}px;
  height: ${HOME_ICON_SIZE}px;
  border-radius: ${HOME_ICON_SIZE}px;
  ${getHomeIconMargin} > svg {
    margin-top: 14px;
  }
`;

const HomeLink = styled(Link)`
  color: ${p => p.theme.purple};

  &:hover {
    color: ${p => p.theme.purpleDark};
  }
`;

const HomeLinkIcon = styled(HomeLink)`
  overflow: hidden;
  width: 100%;
  ${flexCenter};
`;

const ExternalHomeLink = styled(ExternalLink)`
  color: ${p => p.theme.purple};

  &:hover {
    color: ${p => p.theme.purpleDark};
  }
`;

const SupportLinkComponent = ({isOnPremise, href, to, ...props}) => {
  if (isOnPremise) {
    return <ExternalHomeLink href={href} {...props} />;
  }
  return <HomeLink to={to} {...props} />;
};
SupportLinkComponent.propTypes = {
  isOnPremise: PropTypes.bool,
  href: PropTypes.string,
  to: PropTypes.string,
};

const AvatarContainer = styled.div`
  margin-bottom: 20px;
`;

const OrganizationName = styled('div')`
  line-height: 1.1em;

  ${overflowEllipsis};
`;
