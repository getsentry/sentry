import {openHelpSearchModal} from 'sentry/actionCreators/modal';
import type {MenuItemProps} from 'sentry/components/dropdownMenu';
import {IconEllipsis} from 'sentry/icons';
import {t} from 'sentry/locale';
import {ConfigStore} from 'sentry/stores/configStore';
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

export function PrimaryNavigationHelpMenu() {
  const organization = useOrganization();
  const contactSupportItem = getContactSupportItem(organization);
  const openForm = useFeedbackForm();
  const {startTour} = useNavigationTour();

  return (
    <PrimaryNavigation.Menu
      triggerWrap={NavigationTourReminder}
      size="sm"
      items={[
        {
          key: 'search',
          label: t('Search support, docs and more'),
          onAction() {
            openHelpSearchModal({organization});
          },
        },
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
        {
          key: 'actions',
          children: [
            {
              key: 'give-feedback',
              label: t('Give feedback'),
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
