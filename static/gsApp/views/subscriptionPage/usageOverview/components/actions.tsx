import {Button, LinkButton} from '@sentry/scraps/button';
import {DropdownMenu} from '@sentry/scraps/dropdownMenu';
import {Flex, useResponsivePropValue} from '@sentry/scraps/layout';

import {IconDownload, IconEllipsis, IconTable} from 'sentry/icons';
import {t} from 'sentry/locale';
import type {Organization} from 'sentry/types/organization';

import {useCurrentBillingHistory} from 'getsentry/hooks/useCurrentBillingHistory';
import type {Subscription} from 'getsentry/types';
import {trackGetsentryAnalytics} from 'getsentry/utils/trackGetsentryAnalytics';

export function UsageOverviewActions({
  organization,
  subscription,
}: {
  organization: Organization;
  subscription: Subscription;
}) {
  const shouldCollapseActions = useResponsivePropValue({zero: true, xl: false});

  const {currentHistory, isPending, isError} = useCurrentBillingHistory();
  const hasBillingPerms = organization.access.includes('org:billing');
  if (!hasBillingPerms) {
    return null;
  }

  const buttons: Array<{
    icon: React.ReactNode;
    label: string;
    disabled?: boolean;
    onClick?: () => void;
    to?: string;
  }> = [
    {
      label: t('View all usage'),
      // Legacy orgs keep the billing usage history page. Only orgs migrated to
      // the billing platform get the Stats & Usage page.
      to: subscription.hasMigratedToBillingPlatform
        ? `/settings/${organization.slug}/stats/`
        : `/settings/${organization.slug}/billing/usage/`,
      icon: <IconTable />,
    },
    {
      label: t('Download as CSV'),
      icon: <IconDownload />,
      onClick: () => {
        trackGetsentryAnalytics('subscription_page.download_reports.clicked', {
          organization,
          reportType: 'summary',
        });
        if (currentHistory) {
          window.open(currentHistory.links.csv, '_blank');
        }
      },
      disabled: isPending || isError,
    },
  ];

  if (shouldCollapseActions) {
    return (
      <DropdownMenu
        triggerProps={{
          'aria-label': t('More Actions'),
          icon: <IconEllipsis />,
          showChevron: false,
          size: 'sm',
        }}
        items={buttons.map(buttonInfo => ({
          key: buttonInfo.label,
          label: buttonInfo.label,
          onAction: buttonInfo.onClick,
          to: buttonInfo.to,
          disabled: buttonInfo.disabled,
        }))}
      />
    );
  }

  return (
    <Flex gap="lg" direction="row">
      {buttons.map(buttonInfo =>
        buttonInfo.to ? (
          <LinkButton
            key={buttonInfo.label}
            icon={buttonInfo.icon}
            variant="secondary"
            to={buttonInfo.to}
          >
            {buttonInfo.label}
          </LinkButton>
        ) : (
          <Button
            key={buttonInfo.label}
            icon={buttonInfo.icon}
            variant="secondary"
            onClick={buttonInfo.onClick}
            disabled={buttonInfo.disabled}
          >
            {buttonInfo.label}
          </Button>
        )
      )}
    </Flex>
  );
}
