import DocumentTitle from 'react-document-title';
import PropTypes from 'prop-types';
import React from 'react';
import styled from '@emotion/styled';
import {css} from '@emotion/core';

import {t} from 'app/locale';
import OrganizationAvatar from 'app/components/avatar/organizationAvatar';
import UserAvatar from 'app/components/avatar/userAvatar';
import ConfigStore from 'app/stores/configStore';
import ExternalLink from 'app/components/links/externalLink';
import {fetchOrganizationDetails} from 'app/actionCreators/organizations';
import InlineSvg from 'app/components/inlineSvg';
import Link from 'app/components/links/link';
import LoadingIndicator from 'app/components/loadingIndicator';
import {Panel, PanelBody, PanelHeader} from 'app/components/panels';
import overflowEllipsis from 'app/styles/overflowEllipsis';
import SentryTypes from 'app/sentryTypes';
import SettingsLayout from 'app/views/settings/components/settingsLayout';
import withLatestContext from 'app/utils/withLatestContext';
import {Organization} from 'app/types';

const LINKS = {
  DOCUMENTATION: 'https://docs.sentry.io/',
  DOCUMENTATION_PLATFORMS: 'https://docs.sentry.io/clients/',
  DOCUMENATATION_QUICKSTART: 'https://docs.sentry.io/quickstart/',
  DOCUMENTATION_CLI: 'https://docs.sentry.io/learn/cli/',
  DOCUMENTATION_API: 'https://docs.sentry.io/hosted/api/',
  API: '/settings/account/api/',
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

type Props = {
  organization: Organization;
};

class SettingsIndex extends React.Component<Props> {
  static propTypes = {
    organization: SentryTypes.Organization,
  };

  componentDidUpdate(prevProps: Props) {
    const {organization} = this.props;
    if (prevProps.organization === organization) {
      return;
    }

    // if there is no org in context, SidebarDropdown uses an org from `withLatestContext`
    // (which queries the org index endpoint instead of org details)
    // and does not have `access` info
    if (organization && typeof organization.access === 'undefined') {
      fetchOrganizationDetails(organization.slug, {
        setActive: true,
        loadProjects: true,
      });
    }
  }

  render() {
    const {organization} = this.props;
    const user = ConfigStore.get('user');
    const isOnPremise = ConfigStore.get('isOnPremise');

    const organizationSettingsUrl =
      (organization && `/settings/${organization.slug}/`) || '';

    const supportLinkProps = {
      isOnPremise,
      href: LINKS.FORUM,
      to: `${organizationSettingsUrl}support`,
    };
    const supportText = isOnPremise ? t('Community Forums') : t('Contact Support');

    return (
      <DocumentTitle title={organization ? `${organization.slug} Settings` : 'Settings'}>
        <SettingsLayout {...this.props}>
          <GridLayout>
            <GridPanel>
              <HomePanelHeader>
                <HomeLinkIcon to="/settings/account/">
                  <AvatarContainer>
                    <UserAvatar user={user} size={HOME_ICON_SIZE} />
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
            </GridPanel>

            {/* if admin */}
            <GridPanel>
              {!organization && <LoadingIndicator overlay hideSpinner />}
              <HomePanelHeader>
                <HomeLinkIcon to={organizationSettingsUrl}>
                  {organization ? (
                    <AvatarContainer>
                      <OrganizationAvatar
                        organization={organization}
                        size={HOME_ICON_SIZE}
                      />
                    </AvatarContainer>
                  ) : (
                    <HomeIcon color="green">
                      <InlineSvg src="icon-stack" size="44px" />
                    </HomeIcon>
                  )}
                  <OrganizationName>
                    {organization ? organization.slug : t('No Organization')}
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
            </GridPanel>

            <GridPanel>
              <HomePanelHeader>
                <ExternalHomeLink isCentered href={LINKS.DOCUMENTATION}>
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
            </GridPanel>

            <GridPanel>
              <HomePanelHeader>
                <SupportLinkComponent isCentered {...supportLinkProps}>
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
            </GridPanel>

            <GridPanel>
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
                    <HomeLink to={`${organizationSettingsUrl}developer-settings/`}>
                      {t('Your Integrations')}
                    </HomeLink>
                  </li>
                  <li>
                    <ExternalHomeLink href={LINKS.DOCUMENTATION_API}>
                      {t('Documentation')}
                    </ExternalHomeLink>
                  </li>
                </ul>
              </HomePanelBody>
            </GridPanel>
          </GridLayout>
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

const HomeIcon = styled('div')<{color?: string}>`
  background: ${p => p.theme[p.color || 'gray2']};
  color: #fff;
  width: ${HOME_ICON_SIZE}px;
  height: ${HOME_ICON_SIZE}px;
  border-radius: ${HOME_ICON_SIZE}px;
  margin-bottom: 20px;

  ${InlineSvg} {
    margin-top: 14px;
  }
`;

type CenterableProps = {
  isCentered?: boolean;
};

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

const ExternalHomeLink = styled(
  ({
    isCentered,
    ...props
  }: CenterableProps & React.ComponentProps<typeof ExternalLink>) => (
    <ExternalLink {...props} />
  )
)<CenterableProps>`
  color: ${p => p.theme.purple};

  &:hover {
    color: ${p => p.theme.purpleDark};
  }

  ${p => p.isCentered && flexCenter};
`;

type SupportLinkProps = {
  isOnPremise: boolean;
  href: string;
  to: string;
  isCentered?: boolean;
} & (
  | ({isOnPremise: true} & React.ComponentProps<typeof ExternalLink>)
  | ({isOnPremise: false} & React.ComponentProps<typeof HomeLink>)
);

const SupportLinkComponent = ({
  isCentered,
  isOnPremise,
  href,
  to,
  ...props
}: SupportLinkProps) => {
  if (isOnPremise) {
    return <ExternalHomeLink isCentered={isCentered} href={href} {...props} />;
  }
  return <HomeLink to={to} {...props} />;
};

SupportLinkComponent.propTypes = {
  isOnPremise: PropTypes.bool,
  href: PropTypes.string,
  to: PropTypes.string,
  isCentered: PropTypes.bool,
  children: PropTypes.node,
};

const AvatarContainer = styled('div')`
  margin-bottom: 20px;
`;

const OrganizationName = styled('div')`
  line-height: 1.1em;

  ${overflowEllipsis};
`;

const GridLayout = styled('div')`
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  grid-gap: 16px;
`;

const GridPanel = styled(Panel)`
  margin-bottom: 0;
`;
