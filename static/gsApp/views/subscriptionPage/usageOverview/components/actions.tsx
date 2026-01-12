import {useTheme} from '@emotion/react';

import {Button} from 'sentry/components/core/button';
import {LinkButton} from 'sentry/components/core/button/linkButton';
import {Flex} from 'sentry/components/core/layout';
import {DropdownMenu} from 'sentry/components/dropdownMenu';
import {IconDownload, IconEllipsis, IconTable} from 'sentry/icons';
import {t} from 'sentry/locale';
import type {Organization} from 'sentry/types/organization';
import useMedia from 'sentry/utils/useMedia';
import {useNavContext} from 'sentry/views/nav/context';
import {NavLayout} from 'sentry/views/nav/types';

import {useCurrentBillingHistory} from 'getsentry/hooks/useCurrentBillingHistory';
import trackGetsentryAnalytics from 'getsentry/utils/trackGetsentryAnalytics';

function UsageOverviewActions({organization}: {organization: Organization}) {
  const {layout: navLayout, isCollapsed: navIsCollapsed} = useNavContext();
  const isMobile = navLayout === NavLayout.MOBILE;
  const theme = useTheme();
  const shouldCollapseOnLargeScreen =
    useMedia(
      `(min-width: ${theme.breakpoints.lg}) and (max-width: ${theme.breakpoints.xl})`
    ) && !navIsCollapsed;
  const shouldCollapseOnMobile =
    useMedia(`(max-width: ${theme.breakpoints.sm})`) && isMobile;

  const shouldCollapseActions = shouldCollapseOnLargeScreen || shouldCollapseOnMobile;

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
      to: `/settings/${organization.slug}/billing/usage/`,
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
            priority="default"
            to={buttonInfo.to}
          >
            {buttonInfo.label}
          </LinkButton>
        ) : (
          <Button
            key={buttonInfo.label}
            icon={buttonInfo.icon}
            priority="default"
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

export default UsageOverviewActions;
