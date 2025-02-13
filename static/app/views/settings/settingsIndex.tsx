import {useEffect} from 'react';
import type {Theme} from '@emotion/react';
import {css} from '@emotion/react';
import styled from '@emotion/styled';

import {fetchOrganizationDetails} from 'sentry/actionCreators/organizations';
import DemoModeGate from 'sentry/components/acl/demoModeGate';
import OrganizationAvatar from 'sentry/components/avatar/organizationAvatar';
import UserAvatar from 'sentry/components/avatar/userAvatar';
import ExternalLink from 'sentry/components/links/externalLink';
import type {LinkProps} from 'sentry/components/links/link';
import Link from 'sentry/components/links/link';
import LoadingIndicator from 'sentry/components/loadingIndicator';
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
import type {Organization} from 'sentry/types/organization';
import type {ColorOrAlias} from 'sentry/utils/theme';
import normalizeUrl from 'sentry/utils/url/normalizeUrl';
import useApi from 'sentry/utils/useApi';
import {useUser} from 'sentry/utils/useUser';
import withLatestContext from 'sentry/utils/withLatestContext';
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

interface SettingsIndexProps extends RouteComponentProps<{}, {}> {
  organization: Organization;
}

function SettingsIndex({organization, ...props}: SettingsIndexProps) {
  const api = useApi();

  useEffect(() => {
    // if there is no org in context, SidebarDropdown uses an org from `withLatestContext`
    // (which queries the org index endpoint instead of org details)
    // and does not have `access` info
    if (organization && typeof organization.access === 'undefined') {
      fetchOrganizationDetails(api, organization.slug, {
        setActive: true,
        loadProjects: true,
      });
    }
  }, [api, organization]);

  const user = useUser();
  const isSelfHosted = ConfigStore.get('isSelfHosted');

  const organizationSettingsUrl =
    (organization && `/settings/${organization.slug}/`) || '';

  const supportLinkProps = {
    isSelfHosted,
    organizationSettingsUrl,
  };

  const hasNavigationV2 = organization?.features.includes('navigation-sidebar-v2');

  // For the new navigation, we are removing this page. The default base route should
  // be the organization settings page.
  // When GAing, this page should be removed and the redirect should be moved to routes.tsx.
  if (hasNavigationV2) {
    return (
      <Redirect
        to={normalizeUrl(
          `/organizations/${organization.slug}/settings/${organization.slug}/`
        )}
      />
    );
  }

  const myAccount = (
    <GridPanel>
      <HomePanelHeader>
        <HomeLinkIcon to="/settings/account/">
          <UserAvatar user={user} size={HOME_ICON_SIZE} />
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
  );

  const orgSettings = (
    <GridPanel>
      {!organization && <LoadingIndicator overlay hideSpinner />}
      <HomePanelHeader>
        <HomeLinkIcon to={organizationSettingsUrl}>
          {organization ? (
            <OrganizationAvatar organization={organization} size={HOME_ICON_SIZE} />
          ) : (
            <HomeIconContainer color="green300">
              <IconStack size="lg" />
            </HomeIconContainer>
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
            <HomeLink to={`${organizationSettingsUrl}teams/`}>{t('Teams')}</HomeLink>
          </li>
          <li>
            <HomeLink to={`${organizationSettingsUrl}members/`}>{t('Members')}</HomeLink>
          </li>
        </ul>
      </HomePanelBody>
    </GridPanel>
  );

  const documentation = (
    <GridPanel>
      <HomePanelHeader>
        <ExternalHomeLinkIcon href={LINKS.DOCUMENTATION}>
          <HomeIconContainer color="pink300">
            <IconDocs size="lg" />
          </HomeIconContainer>
          {t('Documentation')}
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
          <HomeIconContainer color="activeText">
            <IconSupport size="lg" />
          </HomeIconContainer>
          {t('Support')}
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
          {t('API Keys')}
        </HomeLinkIcon>
      </HomePanelHeader>

      <HomePanelBody>
        <h3>{t('Quick links')}:</h3>
        <ul>
          <li>
            <HomeLink to={`${organizationSettingsUrl}auth-tokens/`}>
              {t('Organization Auth Tokens')}
            </HomeLink>
          </li>
          <li>
            <HomeLink to={LINKS.API}>{t('User Auth Tokens')}</HomeLink>
          </li>
          <li>
            <HomeLink to={`${organizationSettingsUrl}developer-settings/`}>
              {t('Custom Integrations')}
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
  );

  return (
    <SentryDocumentTitle
      title={organization ? `${organization.slug} Settings` : 'Settings'}
    >
      <SettingsLayout {...props}>
        <GridLayout>
          <DemoModeGate>{myAccount}</DemoModeGate>
          {orgSettings}
          {documentation}
          {support}
          <DemoModeGate>{apiKeys} </DemoModeGate>
        </GridLayout>
      </SettingsLayout>
    </SentryDocumentTitle>
  );
}

export default withLatestContext(SettingsIndex);

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
  font-size: ${p => p.theme.fontSizeExtraLarge};
  align-items: center;
  text-transform: unset;
  padding: ${space(4)};
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

const HomeIconContainer = styled('div')<{color?: ColorOrAlias}>`
  background: ${p => p.theme[p.color || 'gray300']};
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
  organizationSettingsUrl: string;
  icon?: boolean;
}

function SupportLink({
  isSelfHosted,
  icon,
  organizationSettingsUrl,
  ...props
}: SupportLinkProps) {
  if (isSelfHosted) {
    const SelfHostedLink = icon ? ExternalHomeLinkIcon : ExternalHomeLink;
    return <SelfHostedLink href={LINKS.FORUM} {...props} />;
  }

  const SelfHostedLink = icon ? HomeLinkIcon : HomeLink;
  return <SelfHostedLink to={`${organizationSettingsUrl}support`} {...props} />;
}

const OrganizationName = styled('div')`
  line-height: 1.1em;

  ${p => p.theme.overflowEllipsis};
`;
