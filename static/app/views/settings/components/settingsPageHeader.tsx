import {Fragment} from 'react';
import styled from '@emotion/styled';

import type {
  BreadcrumbListProps,
  BreadcrumbTitleItem,
} from '@sentry/scraps/breadcrumbList';
import {Flex} from '@sentry/scraps/layout';

import {BreadcrumbTitle} from 'sentry/views/settings/components/settingsBreadcrumb/breadcrumbTitle';

type Props = {
  title: string | BreadcrumbTitleItem;
  action?: React.ReactNode;
  breadcrumbs?: BreadcrumbListProps['items'];
  subtitle?: React.ReactNode;
  /**
   * Lets the subtitle span the available width instead of capping it at 72ch.
   */
  wideSubtitle?: boolean;
};

export function SettingsPageHeader({
  title,
  subtitle,
  action,
  breadcrumbs,
  wideSubtitle,
}: Props) {
  return (
    <Fragment>
      <BreadcrumbTitle title={title} breadcrumbs={breadcrumbs} />
      {(subtitle || action) && (
        <Flex marginBottom="xl" width="100%" justify="between" align="start" gap="md">
          <Subtitle wide={wideSubtitle}>{subtitle}</Subtitle>
          {action}
        </Flex>
      )}
    </Fragment>
  );
}

const Subtitle = styled('div')<{wide?: boolean}>`
  width: 100%;
  max-width: ${p => (p.wide ? 'none' : '72ch')};
  color: ${p => p.theme.tokens.content.secondary};
  font-weight: ${p => p.theme.font.weight.sans.regular};
  font-size: ${p => p.theme.font.size.md};
`;
