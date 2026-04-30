import {useEffect} from 'react';

import {Flex} from '@sentry/scraps/layout';

import type {MenuItemProps} from 'sentry/components/dropdownMenu';
import {
  IconBuilding,
  IconDiscord,
  IconDocs,
  IconEllipsis,
  IconGithub,
  IconGlobe,
  IconGroup,
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
import {useFeedbackForm} from 'sentry/utils/useFeedbackForm';
import {useOrganization} from 'sentry/utils/useOrganization';
import {activateZendesk, hasZendesk} from 'sentry/utils/zendesk';
import {
  NavigationTourReminder,
  useNavigationTour,
} from 'sentry/views/navigation/navigationTour';
import {PrimaryNavigation} from 'sentry/views/navigation/primary/components';

export function PrimaryNavigationHelpMenu() {
  const organization = useOrganization();
  const contactSupportItem = getContactSupportItem(organization);
  const openForm = useFeedbackForm();
  const {privacyUrl, termsUrl} = useLegacyStore(ConfigStore);
  const hasIntercom = organization.features.includes('intercom-support');
  const {startTour} = useNavigationTour();

  useEffect(() => {
    if (hasIntercom) {
      trackAnalytics('intercom_link.viewed', {organization, source: 'sidebar'});
    }
  }, [hasIntercom, organization]);

  const items: MenuItemProps[] = [
    {
      key: 'resources',
      label: t('Resources'),
      isSubmenu: true,
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
          externalHref: 'https://sentry.zendesk.com/hc/en-us',
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
      isSubmenu: true,
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
      isSubmenu: true,
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
                ['feedback.source']: 'navigation_sidebar',
              },
            });
          },
          hidden: !openForm,
        },
        {
          key: 'tour',
          label: t('Tour the new navigation'),
          leadingItems: (
            <MenuIcon>
              <IconGlobe />
            </MenuIcon>
          ),
          onAction() {
            startTour();
          },
        },
      ],
    },
  ];

  return (
    <PrimaryNavigation.Menu
      triggerWrap={NavigationTourReminder}
      items={items}
      analyticsKey="help"
      label={t('Help')}
      icon={<IconEllipsis />}
    />
  );
}

function getContactSupportItem(organization: Organization): MenuItemProps | null {
  const supportEmail = ConfigStore.get('supportEmail');

  if (!supportEmail) {
    return null;
  }

  const hasIntercom = organization.features.includes('intercom-support');

  // Use Intercom if feature flag is enabled (lazily initialized on first click)
  if (hasIntercom) {
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

  // Fall back to Zendesk if available
  if (hasZendesk()) {
    return {
      key: 'support',
      label: t('Contact Support'),
      onAction() {
        activateZendesk();
        trackAnalytics('zendesk_link.clicked', {
          organization,
          source: 'sidebar',
        });
      },
    };
  }

  // Fall back to mailto
  return {
    key: 'support',
    label: t('Contact Support'),
    externalHref: `mailto:${supportEmail}`,
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
