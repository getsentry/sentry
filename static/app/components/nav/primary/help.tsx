import {openHelpSearchModal} from 'sentry/actionCreators/modal';
import {SidebarMenu} from 'sentry/components/nav/primary/components';
import {IconQuestion} from 'sentry/icons';
import {t} from 'sentry/locale';
import ConfigStore from 'sentry/stores/configStore';
import {trackAnalytics} from 'sentry/utils/analytics';
import useMutateUserOptions from 'sentry/utils/useMutateUserOptions';
import useOrganization from 'sentry/utils/useOrganization';

export function PrimaryNavigationHelp() {
  const organization = useOrganization();
  const {mutate: mutateUserOptions} = useMutateUserOptions();

  return (
    <SidebarMenu
      items={[
        {
          key: 'search',
          label: t('Search Support, Docs and More'),
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
            {
              key: 'support',
              label: t('Contact Support'),
              externalHref: `mailto:${ConfigStore.get('supportEmail')}`,
            },
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
          key: 'new-ui',
          children: [
            {
              key: 'new-ui',
              label: t('Switch to old navigation'),
              onAction() {
                mutateUserOptions({prefersStackedNavigation: false});
                trackAnalytics(
                  'navigation.help_menu_opt_out_stacked_navigation_clicked',
                  {
                    organization,
                  }
                );
              },
            },
          ],
        },
      ]}
      analyticsKey="help"
      label={t('Help')}
    >
      <IconQuestion />
    </SidebarMenu>
  );
}
