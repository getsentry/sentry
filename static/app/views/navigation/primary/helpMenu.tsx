import {Fragment, useEffect} from 'react';

import {Flex} from '@sentry/scraps/layout';

import {openModal} from 'sentry/actionCreators/modal';
import type {MenuItemProps} from 'sentry/components/dropdownMenu';
import {ErrorBoundary} from 'sentry/components/errorBoundary';
import {
  IconBroadcast,
  IconBuilding,
  IconDiscord,
  IconDocs,
  IconEllipsis,
  IconGithub,
  IconGroup,
  IconLab,
  IconMegaphone,
  IconOpen,
  IconQuestion,
  IconSentry,
  IconSupport,
} from 'sentry/icons';
import {IconDefaultsProvider} from 'sentry/icons/useIconDefaults';
import {t} from 'sentry/locale';
import {ConfigStore} from 'sentry/stores/configStore';
import {useLegacyStore} from 'sentry/stores/useLegacyStore';
import type {Organization} from 'sentry/types/organization';
import {trackAnalytics} from 'sentry/utils/analytics';
import {showIntercom} from 'sentry/utils/intercom';
import {AuthV2CookieState, useEnableAuthV2} from 'sentry/utils/useEnableAuthV2';
import {useFeedbackForm} from 'sentry/utils/useFeedbackForm';
import {useOrganization} from 'sentry/utils/useOrganization';
import {PrimaryNavigation} from 'sentry/views/navigation/primary/components';
import {
  useWhatsNewBroadcasts,
  WhatsNewContent,
} from 'sentry/views/navigation/primary/whatsNew';

interface PrimaryNavigationHelpMenuProps {
  additionalItems?: MenuItemProps[];
  indicator?: 'accent' | 'danger' | 'warning';
}

export function PrimaryNavigationHelpMenu({
  additionalItems = [],
  indicator,
}: PrimaryNavigationHelpMenuProps = {}) {
  const organization = useOrganization();
  const contactSupportItem = getContactSupportItem(organization);
  const openForm = useFeedbackForm();
  const {privacyUrl, termsUrl} = useLegacyStore(ConfigStore);
  const {isAuthV2Enabled, setAuthV2CookieState} = useEnableAuthV2();

  useEffect(() => {
    trackAnalytics('intercom_link.viewed', {organization, source: 'sidebar'});
  }, [organization]);

  const items: MenuItemProps[] = [
    ...additionalItems,
    {
      key: 'resources',
      label: t('Resources'),
      submenu: true,
      leadingItems: (
        <MenuIcon>
          <IconQuestion />
        </MenuIcon>
      ),
      children: [
        {
          key: 'welcome',
          label: t('Welcome Page'),
          externalHref: 'https://sentry.io/welcome/',
          leadingItems: (
            <MenuIcon>
              <IconSentry />
            </MenuIcon>
          ),
        },
        {
          key: 'docs',
          label: t('Documentation'),
          externalHref: 'https://docs.sentry.io',
          leadingItems: (
            <MenuIcon>
              <IconDocs />
            </MenuIcon>
          ),
        },
        {
          key: 'api-docs',
          label: t('API Docs'),
          externalHref: 'https://docs.sentry.io/api/',
          leadingItems: (
            <MenuIcon>
              <IconDocs />
            </MenuIcon>
          ),
        },
        {
          key: 'help-center',
          label: t('Help Center'),
          externalHref: 'https://www.sentry.help/',
          leadingItems: (
            <MenuIcon>
              <IconQuestion />
            </MenuIcon>
          ),
        },
        {
          key: 'support',
          label: t('Contact Support'),
          ...contactSupportItem,
          leadingItems: (
            <MenuIcon>
              <IconSupport />
            </MenuIcon>
          ),
          hidden: !contactSupportItem,
        },
      ],
    },
    {
      key: 'community',
      label: t('Community'),
      submenu: true,
      leadingItems: (
        <MenuIcon>
          <IconGroup />
        </MenuIcon>
      ),
      children: [
        {
          key: 'github',
          label: t('Sentry on GitHub'),
          externalHref: 'https://github.com/getsentry/sentry',
          leadingItems: (
            <MenuIcon>
              <IconGithub />
            </MenuIcon>
          ),
        },
        {
          key: 'discord',
          label: t('Join our Discord'),
          externalHref: 'https://discord.com/invite/sentry',
          leadingItems: (
            <MenuIcon>
              <IconDiscord />
            </MenuIcon>
          ),
        },
      ],
    },
    {
      key: 'legal',
      label: t('Legal'),
      submenu: true,
      hidden: !privacyUrl && !termsUrl,
      leadingItems: (
        <MenuIcon>
          <IconBuilding />
        </MenuIcon>
      ),
      children: [
        {
          key: 'privacy',
          label: t('Privacy Policy'),
          externalHref: privacyUrl ?? '',
          hidden: !privacyUrl,
          leadingItems: (
            <MenuIcon>
              <IconOpen />
            </MenuIcon>
          ),
        },
        {
          key: 'terms',
          label: t('Terms of Use'),
          externalHref: termsUrl ?? '',
          hidden: !termsUrl,
          leadingItems: (
            <MenuIcon>
              <IconOpen />
            </MenuIcon>
          ),
        },
      ],
    },
    {
      key: 'auth-v2',
      hidden: !organization.features.includes('authv2-enable-toggle'),
      children: [
        {
          key: 'toggle-auth-v2',
          label: isAuthV2Enabled ? t('Disable new login') : t('Enable new login'),
          leadingItems: (
            <MenuIcon>
              <IconLab isSolid />
            </MenuIcon>
          ),
          onAction() {
            setAuthV2CookieState(
              isAuthV2Enabled ? AuthV2CookieState.DISABLED : AuthV2CookieState.ENABLED
            );
          },
        },
      ],
    },
    {
      key: 'actions',
      hidden: !openForm,
      children: [
        {
          key: 'give-feedback',
          label: t('Give feedback'),
          leadingItems: (
            <MenuIcon>
              <IconMegaphone />
            </MenuIcon>
          ),
          onAction() {
            openForm?.({
              tags: {
                'feedback.source': 'navigation_sidebar',
              },
            });
          },
          hidden: !openForm,
        },
      ],
    },
  ];

  return (
    <PrimaryNavigation.Menu
      items={items}
      analyticsKey="help"
      label={t('Help')}
      icon={<IconEllipsis />}
      indicator={indicator}
    />
  );
}

export function useWhatsNewHelpMenuItem(): PrimaryNavigationHelpMenuProps {
  const {unseenPostIds} = useWhatsNewBroadcasts();

  return {
    additionalItems: [
      {
        key: 'whats-new',
        label: t("What's New"),
        leadingItems: (
          <MenuIcon>
            <IconBroadcast />
          </MenuIcon>
        ),
        onAction() {
          openModal(({Header, Body}) => (
            <Fragment>
              <Header closeButton>{t("What's New")}</Header>
              <Body>
                <ErrorBoundary customComponent={null}>
                  <WhatsNewContent />
                </ErrorBoundary>
              </Body>
            </Fragment>
          ));
        },
      },
    ],
    indicator: unseenPostIds.length > 0 ? 'accent' : undefined,
  };
}

function getContactSupportItem(organization: Organization): MenuItemProps | null {
  const supportEmail = ConfigStore.get('supportEmail');

  if (!supportEmail) {
    return null;
  }

  // Use Intercom (lazily initialized on first click)
  return {
    key: 'support',
    label: t('Contact Support'),
    async onAction() {
      trackAnalytics('intercom_link.clicked', {
        organization,
        source: 'sidebar',
      });
      try {
        await showIntercom(organization.slug);
      } catch {
        // Fall back to mailto
        window.location.href = `mailto:${supportEmail}`;
      }
    },
  };
}

function MenuIcon({children}: React.PropsWithChildren) {
  return (
    <IconDefaultsProvider size="sm">
      <Flex width="1em" height="1lh" align="center" justify="center">
        {children}
      </Flex>
    </IconDefaultsProvider>
  );
}
