import {css, type Theme, useTheme} from '@emotion/react';
import styled from '@emotion/styled';

import {OrganizationAvatar} from 'sentry/components/core/avatar/organizationAvatar';
import {UserAvatar} from 'sentry/components/core/avatar/userAvatar';
import type {LinkProps} from 'sentry/components/core/link';
import {ExternalLink, Link} from 'sentry/components/core/link';
import Panel from 'sentry/components/panels/panel';
import PanelBody from 'sentry/components/panels/panelBody';
import PanelHeader from 'sentry/components/panels/panelHeader';
import Redirect from 'sentry/components/redirect';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {IconDocs, IconLock, IconStack, IconSupport} from 'sentry/icons';
import {t} from 'sentry/locale';
import ConfigStore from 'sentry/stores/configStore';
import {space} from 'sentry/styles/space';
import type {RouteComponentProps} from 'sentry/types/legacyReactRouter';
import normalizeUrl from 'sentry/utils/url/normalizeUrl';
import useOrganization from 'sentry/utils/useOrganization';
import {useUser} from 'sentry/utils/useUser';
import {prefersStackedNav} from 'sentry/views/nav/prefersStackedNav';
import SettingsLayout from 'sentry/views/settings/components/settingsLayout';

const LINKS = {
  DOCUMENTATION: 'https://docs.sentry.io/',
  DOCUMENTATION_PLATFORMS: 'https://docs.sentry.io/platforms/',
  DOCUMENTATION_QUICKSTART: 'https://docs.sentry.io/platform-redirect/?next=/',
  DOCUMENTATION_CLI: 'https://docs.sentry.io/cli/',
  DOCUMENTATION_API: 'https://docs.sentry.io/api/',
  API: '/settings/account/api/',
  MANAGE: '/manage/',
  FORUM: 'https://forum.sentry.io/',
  GITHUB_ISSUES: 'https://github.com/getsentry/sentry/issues',
  SERVICE_STATUS: 'https://status.sentry.io/',
};

const HOME_ICON_SIZE = 56;

interface SettingsIndexProps extends RouteComponentProps {}

function SettingsIndex(props: SettingsIndexProps) {
  // Organization may be null on settings index if the user is not part of any
  // organization
  const organization = useOrganization({allowNull: true});
  const user = useUser();
  const theme = useTheme();
  const isSelfHosted = ConfigStore.get('isSelfHosted');

  const organizationSettingsUrl =
    (organization && `/settings/${organization.slug}/`) || '';

  const supportLinkProps = {
    isSelfHosted,
  };

  // For the new navigation, we are removing this page. The default base route should
  // be the organization settings page.
  // When GAing, this page should be removed and the redirect should be moved to routes.tsx.
  if (organization && prefersStackedNav(organization)) {
    return <Redirect to={normalizeUrl(`/settings/${organization.slug}/`)} />;
  }

  const myAccount = (
    <GridPanel>
      <HomePanelHeader>
        <HomeLinkIcon to="/settings/account/">
          <UserAvatar user={user} size={HOME_ICON_SIZE} />
          <HomeLinkLabel>{t('My Account')}</HomeLinkLabel>
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
  );

  const orgSettings = (
    <GridPanel>
      <HomePanelHeader>
        {organization ? (
          <HomeLinkIcon to={organizationSettingsUrl}>
            <OrganizationAvatar organization={organization} size={HOME_ICON_SIZE} />
            <HomeLinkLabel>{organization.slug}</HomeLinkLabel>
          </HomeLinkIcon>
        ) : (
          <HomeLinkIcon to="/organizations/new/">
            <HomeIconContainer color={theme.green300}>
              <IconStack size="lg" />
            </HomeIconContainer>
            <HomeLinkLabel>{t('Create an Organization')}</HomeLinkLabel>
          </HomeLinkIcon>
        )}
      </HomePanelHeader>

      <HomePanelBody>
        <h3>{t('Quick links')}:</h3>
        {organization ? (
          <ul>
            <li>
              <HomeLink to={`${organizationSettingsUrl}projects/`}>
                {t('Projects')}
              </HomeLink>
            </li>
            <li>
              <HomeLink to={`${organizationSettingsUrl}teams/`}>{t('Teams')}</HomeLink>
            </li>
            <li>
              <HomeLink to={`${organizationSettingsUrl}members/`}>
                {t('Members')}
              </HomeLink>
            </li>
          </ul>
        ) : (
          <li>
            <HomeLink to="/organizations/new/">{t('Create an organization')}</HomeLink>
          </li>
        )}
      </HomePanelBody>
    </GridPanel>
  );

  const documentation = (
    <GridPanel>
      <HomePanelHeader>
        <ExternalHomeLinkIcon href={LINKS.DOCUMENTATION}>
          <HomeIconContainer color={theme.pink300}>
            <IconDocs size="lg" />
          </HomeIconContainer>
          <HomeLinkLabel>{t('Documentation')}</HomeLinkLabel>
        </ExternalHomeLinkIcon>
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
  );

  const support = (
    <GridPanel>
      <HomePanelHeader>
        <SupportLink icon {...supportLinkProps}>
          <HomeIconContainer color={theme.activeText}>
            <IconSupport size="lg" />
          </HomeIconContainer>
          <HomeLinkLabel>{t('Support')}</HomeLinkLabel>
        </SupportLink>
      </HomePanelHeader>

      <HomePanelBody>
        <h3>{t('Quick links')}:</h3>
        <ul>
          <li>
            <SupportLink {...supportLinkProps}>
              {isSelfHosted ? t('Community Forums') : t('Contact Support')}
            </SupportLink>
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
  );

  const apiKeys = (
    <GridPanel>
      <HomePanelHeader>
        <HomeLinkIcon to={LINKS.API}>
          <HomeIconContainer>
            <IconLock size="lg" locked />
          </HomeIconContainer>
          <HomeLinkLabel>{t('API Keys')}</HomeLinkLabel>
        </HomeLinkIcon>
      </HomePanelHeader>

      <HomePanelBody>
        <h3>{t('Quick links')}:</h3>
        <ul>
          {organizationSettingsUrl && (
            <li>
              <HomeLink to={`${organizationSettingsUrl}auth-tokens/`}>
                {t('Organization Tokens')}
              </HomeLink>
            </li>
          )}
          <li>
            <HomeLink to={LINKS.API}>{t('Personal Tokens')}</HomeLink>
          </li>
          {organizationSettingsUrl && (
            <li>
              <HomeLink to={`${organizationSettingsUrl}developer-settings/`}>
                {t('Custom Integrations')}
              </HomeLink>
            </li>
          )}
          <li>
            <ExternalHomeLink href={LINKS.DOCUMENTATION_API}>
              {t('Documentation')}
            </ExternalHomeLink>
          </li>
        </ul>
      </HomePanelBody>
    </GridPanel>
  );

  return (
    <SentryDocumentTitle
      title={organization ? `${organization.slug} Settings` : 'Settings'}
    >
      <SettingsLayout {...props}>
        <GridLayout>
          {myAccount}
          {orgSettings}
          {documentation}
          {support}
          {apiKeys}
        </GridLayout>
      </SettingsLayout>
    </SentryDocumentTitle>
  );
}

export default SettingsIndex;

const GridLayout = styled('div')`
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  gap: ${space(2)};
`;

const GridPanel = styled(Panel)`
  margin-bottom: 0;
`;

const HomePanelHeader = styled(PanelHeader)`
  background: ${p => p.theme.background};
  font-size: ${p => p.theme.fontSize.xl};
  align-items: center;
  text-transform: unset;
  padding: ${space(4)} ${space(4)} 0;
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

const HomeIconContainer = styled('div')<{color?: string}>`
  background: ${p => p.color || 'gray300'};
  color: ${p => p.theme.white};
  width: ${HOME_ICON_SIZE}px;
  height: ${HOME_ICON_SIZE}px;
  border-radius: ${HOME_ICON_SIZE}px;
  display: flex;
  justify-content: center;
  align-items: center;
`;

const linkCss = ({theme}: {theme: Theme}) => css`
  color: ${theme.activeText};

  &:hover {
    color: ${theme.activeText};
  }
`;

const linkIconCss = css`
  overflow: hidden;
  width: 100%;
  display: grid;
  grid-template-rows: max-content max-content;
  gap: ${space(1.5)};
  align-items: center;
  justify-items: center;
  justify-content: center;
`;

const HomeLink = styled(Link)`
  ${linkCss}
`;

const ExternalHomeLink = styled(ExternalLink)`
  ${linkCss}
`;

const HomeLinkIcon = styled(HomeLink)`
  ${linkIconCss}
`;

const ExternalHomeLinkIcon = styled(ExternalLink)`
  ${linkIconCss}
`;

interface SupportLinkProps extends Omit<LinkProps, 'ref' | 'to'> {
  isSelfHosted: boolean;
  icon?: boolean;
}

function SupportLink({isSelfHosted, icon, ...props}: SupportLinkProps) {
  if (isSelfHosted) {
    const SelfHostedLink = icon ? ExternalHomeLinkIcon : ExternalHomeLink;
    return <SelfHostedLink href={LINKS.FORUM} {...props} />;
  }

  const SelfHostedLink = icon ? HomeLinkIcon : HomeLink;
  return <SelfHostedLink to="https://sentry.zendesk.com/hc/en-us" {...props} />;
}

const HomeLinkLabel = styled('div')`
  padding-bottom: ${space(4)};
  ${p => p.theme.overflowEllipsis};
`;
