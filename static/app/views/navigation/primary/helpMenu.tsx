import {useEffect} from 'react';

import type {MenuItemProps} from 'sentry/components/dropdownMenu';
import {
  IconBuilding,
  IconDiscord,
  IconDocs,
  IconEllipsis,
  IconGithub,
  IconGroup,
  IconMegaphone,
  IconOpen,
  IconQuestion,
  IconSentry,
  IconSupport,
} from 'sentry/icons';
import {t} from 'sentry/locale';
import {ConfigStore} from 'sentry/stores/configStore';
import {useLegacyStore} from 'sentry/stores/useLegacyStore';
import type {Organization} from 'sentry/types/organization';
import {trackAnalytics} from 'sentry/utils/analytics';
import {showIntercom} from 'sentry/utils/intercom';
import {useFeedbackForm} from 'sentry/utils/useFeedbackForm';
import {useOrganization} from 'sentry/utils/useOrganization';
import {activateZendesk, hasZendesk} from 'sentry/utils/zendesk';
import {PrimaryNavigation} from 'sentry/views/navigation/primary/components';

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

export function PrimaryNavigationHelpMenu() {
  const organization = useOrganization();
  const contactSupportItem = getContactSupportItem(organization);
  const openForm = useFeedbackForm();
  const {privacyUrl, termsUrl} = useLegacyStore(ConfigStore);
  const hasIntercom = organization.features.includes('intercom-support');

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
      leadingItems: <IconQuestion />,
      children: [
        {
          key: 'welcome',
          label: t('Welcome Page'),
          externalHref: 'https://sentry.io/welcome/',
          leadingItems: <IconSentry />,
        },
        {
          key: 'docs',
          label: t('Documentation'),
          externalHref: 'https://docs.sentry.io',
          leadingItems: <IconDocs />,
        },
        {
          key: 'api-docs',
          label: t('API Docs'),
          externalHref: 'https://docs.sentry.io/api/',
          leadingItems: <IconDocs />,
        },
        {
          key: 'help-center',
          label: t('Help Center'),
          externalHref: 'https://sentry.zendesk.com/hc/en-us',
          leadingItems: <IconQuestion />,
        },
        {
          key: 'support',
          label: t('Contact Support'),
          ...contactSupportItem,
          leadingItems: <IconSupport />,
          hidden: !contactSupportItem,
        },
      ],
    },
    {
      key: 'community',
      label: t('Community'),
      isSubmenu: true,
      leadingItems: <IconGroup />,
      children: [
        {
          key: 'github',
          label: t('Sentry on GitHub'),
          externalHref: 'https://github.com/getsentry/sentry',
          leadingItems: <IconGithub />,
        },
        {
          key: 'discord',
          label: t('Join our Discord'),
          externalHref: 'https://discord.com/invite/sentry',
          leadingItems: <IconDiscord />,
        },
      ],
    },
    {
      key: 'legal',
      label: t('Legal'),
      isSubmenu: true,
      hidden: !privacyUrl && !termsUrl,
      leadingItems: <IconBuilding />,
      children: [
        {
          key: 'privacy',
          label: t('Privacy Policy'),
          externalHref: privacyUrl ?? '',
          hidden: !privacyUrl,
          leadingItems: <IconOpen />,
        },
        {
          key: 'terms',
          label: t('Terms of Use'),
          externalHref: termsUrl ?? '',
          hidden: !termsUrl,
          leadingItems: <IconOpen />,
        },
      ],
    },
    {
      key: 'actions',
      children: [
        {
          key: 'give-feedback',
          label: t('Give feedback'),
          leadingItems: <IconMegaphone />,
          onAction() {
            openForm?.({
              tags: {
                ['feedback.source']: 'navigation_sidebar',
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
    />
  );
}
