import {Flex} from '@sentry/scraps/layout';

import {openHelpSearchModal} from 'sentry/actionCreators/modal';
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
  IconSearch,
  IconSentry,
  IconSupport,
} from 'sentry/icons';
import {IconDefaultsProvider} from 'sentry/icons/useIconDefaults';
import {t} from 'sentry/locale';
import {ConfigStore} from 'sentry/stores/configStore';
import {useLegacyStore} from 'sentry/stores/useLegacyStore';
import type {Organization} from 'sentry/types/organization';
import {trackAnalytics} from 'sentry/utils/analytics';
import {useFeedbackForm} from 'sentry/utils/useFeedbackForm';
import {useOrganization} from 'sentry/utils/useOrganization';
import {activateZendesk, hasZendesk} from 'sentry/utils/zendesk';
import {
  NavigationTourReminder,
  useNavigationTour,
} from 'sentry/views/navigation/navigationTour';
import {PrimaryNavigation} from 'sentry/views/navigation/primary/components';
import {useHasPageFrameFeature} from 'sentry/views/navigation/useHasPageFrameFeature';

export function PrimaryNavigationHelpMenu() {
  const organization = useOrganization();
  const contactSupportItem = getContactSupportItem(organization);
  const openForm = useFeedbackForm();
  const {startTour} = useNavigationTour();
  const {privacyUrl, termsUrl} = useLegacyStore(ConfigStore);
  const hasPageFrame = useHasPageFrameFeature();

  const items = hasPageFrame
    ? getPageFrameItems({contactSupportItem, privacyUrl, termsUrl})
    : getLegacyItems({contactSupportItem});

  return (
    <PrimaryNavigation.Menu
      triggerWrap={NavigationTourReminder}
      items={[
        {
          key: 'search',
          label: t('Search support, docs and more'),
          leadingItems: (
            <MenuIcon>
              <IconSearch />
            </MenuIcon>
          ),
          onAction() {
            openHelpSearchModal({organization});
          },
        },
        ...items,
        {
          key: 'actions',
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
          ].filter(n => !!n),
        },
      ]}
      analyticsKey="help"
      label={t('Help')}
      icon={<IconEllipsis />}
    />
  );
}

function MenuIcon({children}: {children: React.ReactNode}) {
  return (
    <IconDefaultsProvider size="sm">
      <Flex width="100%" height="100%" align="center">
        {children}
      </Flex>
    </IconDefaultsProvider>
  );
}

function getPageFrameItems({
  contactSupportItem,
  privacyUrl,
  termsUrl,
}: {
  contactSupportItem: MenuItemProps | null;
  privacyUrl: string | null;
  termsUrl: string | null;
}): MenuItemProps[] {
  return [
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
        ...(contactSupportItem
          ? [
              {
                ...contactSupportItem,
                leadingItems: (
                  <MenuIcon>
                    <IconSupport />
                  </MenuIcon>
                ),
              },
            ]
          : []),
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
    ...(privacyUrl || termsUrl
      ? [
          {
            key: 'legal',
            label: t('Legal'),
            isSubmenu: true,
            leadingItems: (
              <MenuIcon>
                <IconBuilding />
              </MenuIcon>
            ),
            children: [
              ...(privacyUrl
                ? [
                    {
                      key: 'privacy',
                      label: t('Privacy Policy'),
                      externalHref: privacyUrl,
                      leadingItems: (
                        <MenuIcon>
                          <IconOpen />
                        </MenuIcon>
                      ),
                    },
                  ]
                : []),
              ...(termsUrl
                ? [
                    {
                      key: 'terms',
                      label: t('Terms of Use'),
                      externalHref: termsUrl,
                      leadingItems: (
                        <MenuIcon>
                          <IconOpen />
                        </MenuIcon>
                      ),
                    },
                  ]
                : []),
            ],
          },
        ]
      : []),
  ];
}

function getLegacyItems({
  contactSupportItem,
}: {
  contactSupportItem: MenuItemProps | null;
}): MenuItemProps[] {
  return [
    {
      key: 'resources',
      label: t('Resources'),
      children: [
        {
          key: 'help-center',
          label: t('Help Center'),
          externalHref: 'https://sentry.zendesk.com/hc/en-us',
        },
        {
          key: 'docs',
          label: t('Documentation'),
          externalHref: 'https://docs.sentry.io',
        },
      ],
    },
    {
      key: 'help',
      label: t('Get Help'),
      children: [
        ...(contactSupportItem ? [contactSupportItem] : []),
        {
          key: 'github',
          label: t('Sentry on GitHub'),
          externalHref: 'https://github.com/getsentry/sentry/issues',
        },
        {
          key: 'discord',
          label: t('Join our Discord'),
          externalHref: 'https://discord.com/invite/sentry',
        },
      ],
    },
  ];
}

function getContactSupportItem(organization: Organization): MenuItemProps | null {
  const supportEmail = ConfigStore.get('supportEmail');

  if (!supportEmail) {
    return null;
  }

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

  return {
    key: 'support',
    label: t('Contact Support'),
    externalHref: `mailto:${supportEmail}`,
  };
}
