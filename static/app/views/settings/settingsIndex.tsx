import * as React from 'react';
import {RouteComponentProps} from 'react-router';
import {css} from '@emotion/react';
import styled from '@emotion/styled';

import {fetchOrganizationDetails} from 'sentry/actionCreators/organizations';
import DemoModeGate from 'sentry/components/acl/demoModeGate';
import OrganizationAvatar from 'sentry/components/avatar/organizationAvatar';
import UserAvatar from 'sentry/components/avatar/userAvatar';
import ExternalLink, {ExternalLinkProps} from 'sentry/components/links/externalLink';
import Link, {LinkProps} from 'sentry/components/links/link';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {Panel, PanelBody, PanelHeader} from 'sentry/components/panels';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {IconDocs, IconLock, IconStack, IconSupport} from 'sentry/icons';
import {t} from 'sentry/locale';
import ConfigStore from 'sentry/stores/configStore';
import overflowEllipsis from 'sentry/styles/overflowEllipsis';
import {Organization} from 'sentry/types';
import withLatestContext from 'sentry/utils/withLatestContext';
import SettingsLayout from 'sentry/views/settings/components/settingsLayout';

const LINKS = {
  DOCUMENTATION: 'https://docs.sentry.io/',
  DOCUMENTATION_PLATFORMS: 'https://docs.sentry.io/clients/',
  DOCUMENTATION_QUICKSTART: 'https://docs.sentry.io/platform-redirect/?next=/',
  DOCUMENTATION_CLI: 'https://docs.sentry.io/product/cli/',
  DOCUMENTATION_API: 'https://docs.sentry.io/api/',
  API: '/settings/account/api/',
  MANAGE: '/manage/',
  FORUM: 'https://forum.sentry.io/',
  GITHUB_ISSUES: 'https://github.com/getsentry/sentry/issues',
  SERVICE_STATUS: 'https://status.sentry.io/',
};

const HOME_ICON_SIZE = 56;

const flexCenter = css`
  display: flex;
  flex-direction: column;
  align-items: center;
`;

interface SettingsIndexProps extends RouteComponentProps<{}, {}> {
  organization: Organization;
}

class SettingsIndex extends React.Component<SettingsIndexProps> {
  componentDidUpdate(prevProps: SettingsIndexProps) {
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
    const isSelfHosted = ConfigStore.get('isSelfHosted');

    const organizationSettingsUrl =
      (organization && `/settings/${organization.slug}/`) || '';

    const supportLinkProps: SupportLinkExternalProps | SupportLinkInternalProps =
      isSelfHosted
        ? {
            isSelfHosted: true,
            href: LINKS.FORUM,
          }
        : {
            isSelfHosted: false,
            to: `${organizationSettingsUrl}support`,
          };

    const supportText = isSelfHosted ? t('Community Forums') : t('Contact Support');

    return (
      <SentryDocumentTitle
        title={organization ? `${organization.slug} Settings` : 'Settings'}
      >
        <SettingsLayout {...this.props}>
          <GridLayout>
            <DemoModeGate>
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
            </DemoModeGate>

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
                    <HomeIcon color="green300">
                      <IconStack size="lg" />
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
                  <HomeIcon color="pink300">
                    <IconDocs size="lg" />
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
                    <ExternalHomeLink href={LINKS.DOCUMENTATION_QUICKSTART}>
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
                <SupportLinkComponent {...supportLinkProps}>
                  <HomeIcon color="purple300">
                    <IconSupport size="lg" />
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

            <DemoModeGate>
              <GridPanel>
                <HomePanelHeader>
                  <HomeLinkIcon to={LINKS.API}>
                    <HomeIcon>
                      <IconLock size="lg" isSolid />
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
            </DemoModeGate>
          </GridLayout>
        </SettingsLayout>
      </SentryDocumentTitle>
    );
  }
}

export {SettingsIndex};
export default withLatestContext(SettingsIndex);

const HomePanelHeader = styled(PanelHeader)`
  background: ${p => p.theme.background};
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
      color: ${p => p.theme.gray200};
    }
  }
`;

const HomeIcon = styled('div')<{color?: string}>`
  background: ${p => p.theme[p.color || 'gray300']};
  color: ${p => p.theme.white};
  width: ${HOME_ICON_SIZE}px;
  height: ${HOME_ICON_SIZE}px;
  border-radius: ${HOME_ICON_SIZE}px;
  display: flex;
  justify-content: center;
  align-items: center;
  margin-bottom: 20px;
`;

const HomeLink = styled(Link)<LinkProps>`
  color: ${p => p.theme.purple300};

  &:hover {
    color: ${p => p.theme.purple300};
  }
`;

const HomeLinkIcon = styled(HomeLink)<LinkProps>`
  overflow: hidden;
  width: 100%;
  ${flexCenter};
`;

interface ExternalHomeLinkProps extends ExternalLinkProps {
  isCentered?: boolean;
}

const ExternalHomeLink = styled((props: ExternalHomeLinkProps) => {
  const {isCentered: _isCentered, ...rest} = props;
  return <ExternalLink {...rest} />;
})<ExternalHomeLinkProps>`
  color: ${p => p.theme.purple300};

  &:hover {
    color: ${p => p.theme.purple300};
  }

  ${p => p.isCentered && flexCenter};
`;

interface SupportLinkExternalProps extends ExternalHomeLinkProps {
  href: string;
  isSelfHosted: true;
  isCentered?: boolean;
}
interface SupportLinkInternalProps extends Omit<LinkProps, 'ref'> {
  isSelfHosted: false;
  to: string;
}

function SupportLinkComponent(
  props: SupportLinkExternalProps | SupportLinkInternalProps
) {
  if (props.isSelfHosted) {
    const {isSelfHosted: _isSelfHosted, ...rest} = props;
    return <ExternalHomeLink {...rest} />;
  }

  return <HomeLink {...props} />;
}

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
  gap: 16px;
`;

const GridPanel = styled(Panel)`
  margin-bottom: 0;
`;
